import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Archive, Check, MessageSquareText, Pencil, Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, FlatList, Pressable, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback-state';
import { useAppTheme } from '@/contexts/theme-context';
import { useAuth } from '@/contexts/auth-context';
import { formatDate } from '@/lib/format';
import { friendlyError } from '@/lib/errors';
import { archiveConversation, listConversations, renameConversation } from '@/services/conversations';
import { radius } from '@/theme/tokens';
import type { Conversation } from '@/types/database';
import { getSupabase } from '@/lib/supabase';
import { workspaceService } from '@/services/workspace';

export function ConversationList({ query = '' }: { query?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try { setItems(await listConversations(query)); setError(null); }
    catch (loadError) { setError(friendlyError(loadError, 'Could not load your conversations.')); }
    finally { if (showLoading) setLoading(false); }
  }, [query]);

  useEffect(() => { const timeout = setTimeout(() => void load(), query ? 250 : 0); return () => clearTimeout(timeout); }, [load, query]);

  useEffect(() => {
    if (!user) return;
    const supabase = getSupabase();
    const channel = supabase.channel(`conversation-list-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'jela_conversations', filter: `owner_id=eq.${user.id}`,
      }, () => void load(false))
      .subscribe();
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') void load(false); });
    return () => { appState.remove(); void supabase.removeChannel(channel); };
  }, [load, user]);

  if (loading) return <LoadingState label="Loading history…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!items.length) {
    return <EmptyState title={query ? 'No matching conversations' : 'No conversation history yet'} message={query ? 'Try a different word or phrase.' : 'New conversations will appear here after you send your first message.'} action={!query ? <Button onPress={() => router.replace('/(user)')}>Start a chat</Button> : undefined} />;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      contentContainerStyle={{ paddingBottom: 24 }}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/(user)/conversation/${item.id}` as Href)}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
            borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
            backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
          })}
        >
          <MessageSquareText color={colors.primary} size={22} />
          <View style={{ flex: 1, gap: 3 }}>
            {editingId === item.id ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><TextInput autoFocus accessibilityLabel="Conversation title" value={editTitle} onChangeText={setEditTitle} maxLength={160} style={{ flex: 1, minHeight: 40, color: colors.text, backgroundColor: colors.background, borderColor: colors.primary, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10 }} /><Pressable accessibilityLabel="Save conversation title" onPress={async (event) => { event.stopPropagation(); const nextTitle = editTitle.trim(); if (!nextTitle) { setError('Enter a conversation title.'); return; } const previous = item.title; setEditingId(null); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, title: nextTitle } : entry)); try { await renameConversation(item.id, nextTitle); } catch (caught) { setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, title: previous } : entry)); setError(friendlyError(caught, 'Could not rename this conversation.')); } }}><Check color={colors.primary} size={19} /></Pressable><Pressable accessibilityLabel="Cancel rename" onPress={(event) => { event.stopPropagation(); setEditingId(null); }}><X color={colors.textMuted} size={19} /></Pressable></View> : <AppText variant="label" numberOfLines={2}>{item.title}</AppText>}
            <AppText tone="muted" variant="caption">Updated {formatDate(item.updated_at)}</AppText>
          </View>
          <Pressable accessibilityLabel={`Rename ${item.title}`} hitSlop={10} onPress={(event) => { event.stopPropagation(); setEditTitle(item.title); setEditingId(item.id); }} style={{ padding: 7 }}><Pencil color={colors.textMuted} size={18} /></Pressable>
          <Pressable
            accessibilityLabel={`Archive ${item.title}`}
            hitSlop={10}
            onPress={async (event) => {
              event.stopPropagation();
              const previous = items;
              setItems((current) => current.filter((entry) => entry.id !== item.id));
              try { await archiveConversation(item.id); }
              catch (archiveError) { setItems(previous); setError(friendlyError(archiveError, 'Could not archive this conversation.')); }
            }}
            style={{ padding: 7 }}
          >
            <Archive color={colors.textMuted} size={19} />
          </Pressable>
          <Pressable accessibilityLabel={`Delete ${item.title}`} hitSlop={10} onPress={(event) => { event.stopPropagation(); Alert.alert('Delete conversation?', 'Messages, chat attachments, generated images, and summaries in this conversation will be permanently removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void workspaceService.deleteConversation(item.id).then(() => setItems((current) => current.filter((entry) => entry.id !== item.id))).catch((caught) => setError(friendlyError(caught, 'Could not delete this conversation.'))) }]); }} style={{ padding: 7 }}><Trash2 color={colors.danger} size={19} /></Pressable>
        </Pressable>
      )}
    />
  );
}
