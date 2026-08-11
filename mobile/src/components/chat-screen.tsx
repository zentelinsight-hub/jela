import { FlashList, type FlashListRef } from '@shopify/flash-list';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Check, Copy, Paperclip, RefreshCw, Send, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/app-header';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback-state';
import { MenuSheet } from '@/components/menu-sheet';
import { useAuth } from '@/contexts/auth-context';
import { useFeatures } from '@/contexts/feature-context';
import { useAppTheme } from '@/contexts/theme-context';
import { friendlyError } from '@/lib/errors';
import { chatInputSchema } from '@/lib/validation';
import { pickAndUploadAttachment } from '@/services/attachments';
import { createRequestId, streamJelaResponse } from '@/services/chat';
import { fetchConversation } from '@/services/conversations';
import { radius } from '@/theme/tokens';
import type { ChatMessage } from '@/types/database';

type LocalMessage = ChatMessage & { local?: boolean };
type AttachmentDraft = { id: string; file_name: string };

function makeLocalMessage(role: 'user' | 'assistant', content: string, status: ChatMessage['status']): LocalMessage {
  return {
    id: `local-${role}-${Date.now()}-${Math.random()}`,
    conversation_id: '',
    owner_id: '',
    role,
    content,
    status,
    request_id: null,
    error_code: null,
    created_at: new Date().toISOString(),
    local: true,
  };
}

function MessageRow({ message, onRetry }: { message: LocalMessage; onRetry?: () => void }) {
  const { colors } = useAppTheme();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  return (
    <View style={{ alignItems: isUser ? 'flex-end' : 'stretch', paddingHorizontal: 16, paddingVertical: 9 }}>
      <View
        style={{
          maxWidth: isUser ? '86%' : '100%',
          paddingHorizontal: isUser ? 15 : 0,
          paddingVertical: isUser ? 11 : 3,
          borderRadius: isUser ? radius.lg : 0,
          backgroundColor: isUser ? colors.userBubble : 'transparent',
          gap: 8,
        }}
      >
        {!isUser ? <AppText variant="label" tone="success">Jela AI</AppText> : null}
        <AppText selectable>{message.content || (message.status === 'streaming' ? 'Thinking…' : '')}</AppText>
        {message.status === 'streaming' ? <ActivityIndicator color={colors.primary} size="small" style={{ alignSelf: 'flex-start' }} /> : null}
        {message.status === 'failed' ? (
          <View style={{ gap: 8 }}>
            <AppText tone="danger" variant="caption">The response stopped before it finished.</AppText>
            {onRetry ? <Button variant="secondary" icon={<RefreshCw color={colors.text} size={16} />} onPress={onRetry}>Retry safely</Button> : null}
          </View>
        ) : null}
        {!isUser && message.content ? (
          <Pressable
            accessibilityLabel="Copy response"
            accessibilityRole="button"
            onPress={async () => {
              await Clipboard.setStringAsync(message.content);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
            hitSlop={8}
            style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 5, alignItems: 'center' }}
          >
            {copied ? <Check color={colors.success} size={15} /> : <Copy color={colors.textMuted} size={15} />}
            <AppText tone={copied ? 'success' : 'muted'} variant="caption">{copied ? 'Copied' : 'Copy'}</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function ChatScreen({ initialConversationId }: { initialConversationId?: string }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { flags, loading: featuresLoading } = useFeatures();
  const { account } = useAuth();
  const listRef = useRef<FlashListRef<LocalMessage>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null);
  const [title, setTitle] = useState('New chat');
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(Boolean(initialConversationId));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lastRequest, setLastRequest] = useState<{ message: string; requestId: string; attachmentIds: string[] } | null>(null);
  const canChat = flags.chat_enabled && account?.status === 'active' && !flags.maintenance_mode;

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const data = await fetchConversation(id);
      setConversationId(data.conversation.id);
      setTitle(data.conversation.title);
      setMessages(data.messages);
      setError(null);
    } catch (loadError) {
      setError(friendlyError(loadError, 'Could not load this conversation.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialConversationId) void load(initialConversationId);
    return () => abortRef.current?.abort();
  }, [initialConversationId, load]);

  const runRequest = async (messageText: string, requestId: string, attachmentIds: string[]) => {
    setSending(true);
    setError(null);
    setLastRequest({ message: messageText, requestId, attachmentIds });
    const userMessage = makeLocalMessage('user', messageText, 'complete');
    const assistantMessage = makeLocalMessage('assistant', '', 'streaming');
    const localUserId = userMessage.id;
    const localAssistantId = assistantMessage.id;
    let canonicalAssistantId = localAssistantId;
    let acceptedConversationId = conversationId;
    setMessages((current) => [...current.filter((item) => item.status !== 'failed'), userMessage, assistantMessage]);
    setInput('');
    setAttachments([]);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamJelaResponse(
        { message: messageText, conversationId, attachmentIds, requestId },
        (event) => {
          if (event.type === 'accepted') {
            setConversationId(event.conversationId);
            acceptedConversationId = event.conversationId;
            canonicalAssistantId = event.assistantMessageId;
            setMessages((current) => current.map((item) => {
              if (item.id === localUserId) return { ...item, id: event.userMessageId, conversation_id: event.conversationId };
              if (item.id === localAssistantId) return { ...item, id: event.assistantMessageId, conversation_id: event.conversationId };
              return item;
            }));
          } else if (event.type === 'delta') {
            setMessages((current) => current.map((item) =>
              item.id === localAssistantId || item.id === canonicalAssistantId
                ? { ...item, content: `${item.content}${event.delta}` }
                : item,
            ));
          } else if (event.type === 'done') {
            setMessages((current) => current.map((item) =>
              item.id === localAssistantId || item.id === canonicalAssistantId
                ? { ...item, status: 'complete' }
                : item,
            ));
          } else if (event.type === 'error') {
            throw new Error(event.message);
          }
        },
        controller.signal,
      );
      if (acceptedConversationId) await load(acceptedConversationId);
    } catch (requestError) {
      if ((requestError as Error).name !== 'AbortError') {
        setMessages((current) => current.map((item) =>
          item.id === localAssistantId || item.id === canonicalAssistantId
            ? { ...item, status: 'failed' }
            : item,
        ));
        setError(friendlyError(requestError, 'The response could not be completed.'));
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  const submit = async () => {
    const parsed = chatInputSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Write a message first.'); return; }
    await runRequest(parsed.data, createRequestId(), attachments.map((item) => item.id));
  };

  const attach = async () => {
    setUploading(true);
    try {
      const record = await pickAndUploadAttachment(conversationId);
      if (record) setAttachments((current) => [...current, { id: record.id, file_name: record.file_name }]);
    } catch (attachmentError) {
      setError(friendlyError(attachmentError, 'Could not upload this file.'));
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setConversationId(null); setTitle('New chat'); setMessages([]); setInput(''); setError(null); setAttachments([]);
    if (initialConversationId) router.replace('/(user)');
  };

  if (loading || featuresLoading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><LoadingState label="Loading conversation…" /></SafeAreaView>;
  if (initialConversationId && error && messages.length === 0) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ErrorState message={error} onRetry={() => void load(initialConversationId)} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <AppHeader title={title} subtitle="Jela AI" onBack={initialConversationId ? () => router.back() : undefined} onMenu={initialConversationId ? undefined : () => setMenuOpen(true)} onNew={reset} />
        {!canChat ? (
          <EmptyState
            title={account?.status === 'restricted' ? 'AI access is restricted' : flags.maintenance_mode ? 'Jela AI is under maintenance' : 'Chat is not enabled yet'}
            message={account?.status === 'restricted' ? 'You can still review your account and history, but new prompts and uploads are blocked by the server until an administrator restores Active status.' : flags.maintenance_mode ? 'Your account and history remain safe. Try again after maintenance is complete.' : 'The production AI model and credit policy must be configured by an administrator before messages can be sent. Your history and account remain available.'}
          />
        ) : messages.length === 0 ? (
          <EmptyState title="What can I help you think through?" message="Ask Jela AI a question, plan a project, or continue from your history." />
        ) : (
          <FlashList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageRow
                message={item}
                onRetry={item.status === 'failed' && lastRequest ? () => void runRequest(lastRequest.message, lastRequest.requestId, lastRequest.attachmentIds) : undefined}
              />
            )}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={{ paddingVertical: 12 }}
          />
        )}
        {error && messages.length > 0 ? (
          <View style={{ paddingHorizontal: 16, paddingVertical: 6 }}><AppText tone="danger" variant="caption">{error}</AppText></View>
        ) : null}
        {canChat ? (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, gap: 8 }}>
            {attachments.map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6 }}>
                <AppText variant="caption" numberOfLines={1} style={{ maxWidth: 250 }}>{item.file_name}</AppText>
                <Pressable accessibilityLabel={`Remove ${item.file_name}`} onPress={() => setAttachments((current) => current.filter((entry) => entry.id !== item.id))}><X color={colors.textMuted} size={16} /></Pressable>
              </View>
            ))}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              {flags.attachments_enabled && account?.status === 'active' ? (
                <Pressable accessibilityLabel="Attach a file" accessibilityRole="button" disabled={uploading || sending} onPress={attach} style={{ padding: 11 }}>
                  {uploading ? <ActivityIndicator color={colors.primary} /> : <Paperclip color={colors.text} />}
                </Pressable>
              ) : null}
              <TextInput
                accessibilityLabel="Message Jela AI"
                multiline
                maxLength={8000}
                placeholder="Message Jela AI"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.primary}
                value={input}
                onChangeText={setInput}
                editable={!sending}
                style={{ flex: 1, maxHeight: 140, minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontSize: 16, paddingHorizontal: 15, paddingVertical: 12 }}
              />
              <Pressable
                accessibilityLabel={sending ? 'Sending message' : 'Send message'}
                accessibilityRole="button"
                disabled={sending || !input.trim()}
                onPress={() => void submit()}
                style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.primary, opacity: sending || !input.trim() ? 0.45 : 1 }}
              >
                {sending ? <ActivityIndicator color="#FFFFFF" /> : <Send color="#FFFFFF" size={21} />}
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      <MenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </SafeAreaView>
  );
}
