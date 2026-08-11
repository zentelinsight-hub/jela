import { getSupabase } from '@/lib/supabase';
import type { ChatMessage, Conversation } from '@/types/database';

export async function listConversations(query = ''): Promise<Conversation[]> {
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
}

export async function fetchConversation(id: string) {
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
  return {
    conversation: conversationResult.data as Conversation,
    messages: (messagesResult.data ?? []) as ChatMessage[],
  };
}

export async function archiveConversation(id: string) {
  const { error } = await getSupabase()
    .from('jela_conversations')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
