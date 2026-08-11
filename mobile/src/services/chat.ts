import * as Crypto from 'expo-crypto';

import { appConfig } from '@/lib/config';
import { UserMessageError } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase';

export type ChatStreamEvent =
  | {
      type: 'accepted';
      conversationId: string;
      userMessageId: string;
      assistantMessageId: string;
    }
  | { type: 'delta'; delta: string }
  | { type: 'done'; usageAvailable?: boolean; resetAt?: string | null }
  | { type: 'error'; code: string; message: string; retryable: boolean };

export type SendMessageInput = {
  message: string;
  conversationId?: string | null;
  attachmentIds?: string[];
  requestId?: string;
  mode?: 'auto' | 'deep_think' | 'research';
};

export function createRequestId() {
  return Crypto.randomUUID();
}

function parseEventBlock(block: string): ChatStreamEvent | null {
  const payload = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!payload) return null;
  try {
    return JSON.parse(payload) as ChatStreamEvent;
  } catch {
    return {
      type: 'error',
      code: 'invalid_stream',
      message: 'The AI service returned an unreadable response.',
      retryable: true,
    };
  }
}

export async function streamJelaResponse(
  input: SendMessageInput,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal,
) {
  if (!appConfig) throw new UserMessageError('Jela AI is not connected to its backend yet.');
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new UserMessageError('Your session expired. Sign in again.');

  const response = await fetch(`${appConfig.supabaseUrl}/functions/v1/jela-chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: appConfig.supabasePublishableKey,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'X-Idempotency-Key': input.requestId ?? createRequestId(),
    },
    body: JSON.stringify({
      message: input.message,
      conversation_id: input.conversationId ?? null,
      attachment_ids: input.attachmentIds ?? [],
      mode: input.mode ?? 'auto',
    }),
    signal,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new UserMessageError(body?.message ?? 'The AI service could not complete this request.');
  }

  if (!response.body) throw new UserMessageError('Streaming is unavailable on this device.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? '';
    blocks.forEach((block) => {
      const event = parseEventBlock(block);
      if (event) onEvent(event);
    });
    if (done) break;
  }

  const finalEvent = parseEventBlock(buffer);
  if (finalEvent) onEvent(finalEvent);
}
