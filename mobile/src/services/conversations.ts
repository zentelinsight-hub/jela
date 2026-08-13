import { getSupabase } from '@/lib/supabase';
import type { ChatMessage, Conversation } from '@/types/database';
import { cachedRequest } from '@/lib/offline-cache';

export async function listConversations(query = ''): Promise<Conversation[]> {
  return cachedRequest(`conversations.${query.trim().toLocaleLowerCase()}`, async () => {
  let request = getSupabase()
    .from('jela_conversations')
    .select('*')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (query.trim()) request = request.ilike('title', `%${query.trim()}%`);
  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []) as Conversation[];
  });
}

export async function fetchConversation(id: string) {
  return cachedRequest(`conversation.${id}`, async () => {
  const supabase = getSupabase();
  const [conversationResult, messagesResult] = await Promise.all([
    supabase.from('jela_conversations').select('*').eq('id', id).single(),
    supabase
      .from('jela_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(500),
  ]);
  if (conversationResult.error) throw conversationResult.error;
  if (messagesResult.error) throw messagesResult.error;
  const messages = (messagesResult.data ?? []) as ChatMessage[];
  const imageIds = messages.map((message) => message.metadata?.generated_image_id)
    .filter((value): value is string => typeof value === 'string');
  const imageUrls = new Map<string, string>();
  if (imageIds.length > 0) {
    const images = await supabase.from('jela_generated_images').select('id,storage_path').in('id', imageIds).eq('status', 'ready');
    if (!images.error) await Promise.all((images.data ?? []).map(async (image) => {
      const signed = await supabase.storage.from('jela-generated-images').createSignedUrl(image.storage_path, 3600);
      if (signed.data?.signedUrl) imageUrls.set(image.id, signed.data.signedUrl);
    }));
  }
  return {
    conversation: conversationResult.data as Conversation,
    messages: messages.map((message) => {
      const imageId = message.metadata?.generated_image_id;
      return typeof imageId === 'string' && imageUrls.has(imageId)
        ? { ...message, metadata: { ...message.metadata, generated_image_url: imageUrls.get(imageId) } }
        : message;
    }),
  };
  });
}

export async function archiveConversation(id: string) {
  const { error } = await getSupabase()
    .from('jela_conversations')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function renameConversation(id: string, title: string) {
  const normalized = title.trim();
  if (!normalized || normalized.length > 160) throw new Error('Use a conversation title between 1 and 160 characters.');
  const { error } = await getSupabase()
    .from('jela_conversations')
    .update({ title: normalized, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
