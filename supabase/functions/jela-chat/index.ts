import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const streamHeaders = {
  ...corsHeaders,
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JelaMode = 'auto' | 'deep_think' | 'research';

type BeginResult = {
  replay: boolean;
  status: 'processing' | 'complete' | 'failed';
  conversation_id: string;
  user_message_id: string;
  assistant_message_id: string;
  assistant_content?: string;
  provider?: string;
  model?: string;
  mode?: JelaMode;
  system_prompt?: string;
  reasoning_effort?: string;
  tools?: Array<Record<string, unknown>>;
  max_output_tokens?: number;
};

type OpenAIResponse = {
  id?: string;
  usage?: {
    input_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens?: number;
  };
  output?: Array<{ type?: string }>;
  error?: { code?: string; message?: string };
};

type OpenAIEvent = {
  type?: string;
  delta?: string;
  item?: { type?: string };
  error?: { code?: string; message?: string };
  response?: OpenAIResponse;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function publicError(message: string) {
  const mappings: Record<string, { status: number; code: string; message: string }> = {
    account_unavailable: { status: 403, code: 'account_unavailable', message: 'This account cannot use Jela right now.' },
    chat_not_enabled: { status: 503, code: 'chat_not_enabled', message: 'Jela is temporarily unavailable. Please try again shortly.' },
    ai_maintenance: { status: 503, code: 'ai_maintenance', message: 'Jela is temporarily unavailable. Please try again shortly.' },
    model_not_configured: { status: 503, code: 'model_not_configured', message: 'This Jela mode is temporarily unavailable.' },
    mode_not_available: { status: 403, code: 'mode_not_available', message: 'This Jela mode is not available on your current plan.' },
    usage_limit_reached: { status: 429, code: 'usage_limit_reached', message: "You've reached today's Free usage limit." },
    conversation_not_found: { status: 404, code: 'conversation_not_found', message: 'This conversation is unavailable.' },
    invalid_message: { status: 400, code: 'invalid_message', message: 'Write a message between 1 and 8,000 characters.' },
    invalid_attachment: { status: 400, code: 'invalid_attachment', message: 'One or more attachments are unavailable.' },
    attachments_not_enabled: { status: 503, code: 'attachments_not_enabled', message: 'File uploads are not available right now.' },
    too_many_attachments: { status: 400, code: 'too_many_attachments', message: 'Attach no more than five files.' },
    idempotency_conflict: { status: 409, code: 'idempotency_conflict', message: 'This request was already used for another operation.' },
  };
  const match = Object.entries(mappings).find(([key]) => message.includes(key));
  return match?.[1] ?? { status: 500, code: 'request_failed', message: "Jela couldn't complete that request. Please try again." };
}

function eventPayload(value: Record<string, unknown>) {
  return `data: ${JSON.stringify(value)}\n\n`;
}

function parseSseBlock(block: string): OpenAIEvent | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!data || data === '[DONE]') return null;
  try {
    return JSON.parse(data) as OpenAIEvent;
  } catch {
    return null;
  }
}

async function safetyIdentifier(userId: string) {
  const bytes = new TextEncoder().encode(`jela-ai:${userId}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

function countTools(response: OpenAIResponse | undefined) {
  const output = response?.output ?? [];
  const toolCalls = output
    .map((item) => item.type ?? '')
    .filter((type) => type.endsWith('_call'));
  return {
    toolCalls,
    webSearchCount: toolCalls.filter((type) => type === 'web_search_call').length,
    fileOperationCount: toolCalls.filter((type) => type === 'file_search_call').length,
    imageOperationCount: toolCalls.filter((type) => type === 'image_generation_call').length,
  };
}

async function buildProviderInput(
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  message: string,
  attachmentIds: string[],
) {
  const content: Array<Record<string, unknown>> = [];
  if (message) content.push({ type: 'input_text', text: message });
  if (attachmentIds.length > 0) {
    const attachments = await serviceClient
      .from('jela_attachments')
      .select('id,storage_path,file_name,mime_type')
      .in('id', attachmentIds)
      .eq('owner_id', userId)
      .eq('status', 'ready');
    if (attachments.error || (attachments.data?.length ?? 0) !== attachmentIds.length) throw new Error('invalid_attachment');
    for (const attachment of attachments.data ?? []) {
      const signed = await serviceClient.storage.from('jela-attachments').createSignedUrl(attachment.storage_path, 300);
      if (signed.error) throw new Error('attachment_access_failed');
      if (attachment.mime_type.startsWith('image/')) {
        content.push({ type: 'input_image', image_url: signed.data.signedUrl, detail: 'auto' });
      } else {
        content.push({ type: 'input_file', file_url: signed.data.signedUrl, filename: attachment.file_name });
      }
    }
  }
  return [{ role: 'user', content }];
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });

  const authorization = request.headers.get('Authorization');
  const idempotencyKey = request.headers.get('X-Idempotency-Key');
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse(401, { code: 'authentication_required', message: 'Sign in to continue.' });
  }
  if (!idempotencyKey || !uuidPattern.test(idempotencyKey)) {
    return jsonResponse(400, { code: 'invalid_idempotency_key', message: 'A valid request identifier is required.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const openAIKey = Deno.env.get('OPENAI_API_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !openAIKey) {
    return jsonResponse(503, { code: 'backend_not_configured', message: 'Jela is temporarily unavailable. Please try again shortly.' });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse(401, { code: 'invalid_session', message: 'Your session has expired. Sign in again to continue.' });
  }

  let body: { message?: unknown; conversation_id?: unknown; attachment_ids?: unknown; mode?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { code: 'invalid_json', message: 'The request body must be valid JSON.' });
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const conversationId = body.conversation_id === null || body.conversation_id === undefined
    ? null
    : typeof body.conversation_id === 'string' && uuidPattern.test(body.conversation_id)
      ? body.conversation_id
      : undefined;
  const rawAttachments = Array.isArray(body.attachment_ids) ? body.attachment_ids : [];
  const attachmentIds = rawAttachments.filter((value): value is string => typeof value === 'string' && uuidPattern.test(value));
  const mode: JelaMode = body.mode === 'deep_think' || body.mode === 'research' ? body.mode : 'auto';
  if (!message || message.length > 8000 || conversationId === undefined || attachmentIds.length !== rawAttachments.length) {
    return jsonResponse(400, { code: 'invalid_request', message: 'Check your message and attachments, then try again.' });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const begin = await serviceClient.rpc('begin_jela_chat_request', {
    p_user_id: userData.user.id,
    p_request_id: idempotencyKey,
    p_conversation_id: conversationId,
    p_message: message,
    p_mode: mode,
    p_attachment_ids: attachmentIds,
  });
  if (begin.error) {
    const error = publicError(begin.error.message);
    return jsonResponse(error.status, { code: error.code, message: error.message });
  }

  const accepted = begin.data as BeginResult;
  if (accepted.replay && accepted.status === 'complete') {
    return new Response(
      eventPayload({
        type: 'accepted',
        conversationId: accepted.conversation_id,
        userMessageId: accepted.user_message_id,
        assistantMessageId: accepted.assistant_message_id,
        mode: accepted.mode ?? mode,
        replay: true,
      }) + eventPayload({ type: 'delta', delta: accepted.assistant_content ?? '' }) + eventPayload({ type: 'done' }),
      { headers: streamHeaders },
    );
  }

  const startedAt = Date.now();
  let providerInput: Array<Record<string, unknown>>;
  try {
    providerInput = await buildProviderInput(serviceClient, userData.user.id, message, attachmentIds);
  } catch {
    await serviceClient.rpc('fail_jela_chat_request', {
      p_user_id: userData.user.id, p_request_id: idempotencyKey, p_error_code: 'attachment_access_failed',
      p_error_message: 'An attachment could not be prepared.', p_partial_content: '', p_duration_ms: Date.now() - startedAt,
    });
    return jsonResponse(400, { code: 'attachment_access_failed', message: 'Jela could not read that attachment. Remove it and try again.' });
  }
  const providerBody: Record<string, unknown> = {
    model: accepted.model,
    instructions: accepted.system_prompt,
    input: providerInput,
    max_output_tokens: accepted.max_output_tokens,
    stream: true,
    store: false,
    safety_identifier: await safetyIdentifier(userData.user.id),
  };
  if (accepted.reasoning_effort && accepted.reasoning_effort !== 'none') {
    providerBody.reasoning = { effort: accepted.reasoning_effort };
  }
  if (Array.isArray(accepted.tools) && accepted.tools.length > 0) providerBody.tools = accepted.tools;

  const upstream = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAIKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(providerBody),
  });
  if (!upstream.ok || !upstream.body) {
    await serviceClient.rpc('fail_jela_chat_request', {
      p_user_id: userData.user.id,
      p_request_id: idempotencyKey,
      p_error_code: `provider_${upstream.status}`,
      p_error_message: 'The AI provider request did not start.',
      p_partial_content: '',
      p_duration_ms: Date.now() - startedAt,
    });
    return jsonResponse(upstream.status === 429 ? 503 : 502, {
      code: 'provider_unavailable',
      message: 'Jela is temporarily unavailable. Your usage was not charged.',
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const responseStream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(eventPayload({
        type: 'accepted',
        conversationId: accepted.conversation_id,
        userMessageId: accepted.user_message_id,
        assistantMessageId: accepted.assistant_message_id,
        mode: accepted.mode ?? mode,
      })));

      let buffer = '';
      let output = '';
      let completedResponse: OpenAIResponse | undefined;
      try {
        const reader = upstream.body!.getReader();
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() ?? '';
          for (const block of blocks) {
            const event = parseSseBlock(block);
            if (!event) continue;
            if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
              output += event.delta;
              controller.enqueue(encoder.encode(eventPayload({ type: 'delta', delta: event.delta })));
            } else if (event.type === 'response.completed') {
              completedResponse = event.response;
            } else if (event.type === 'response.failed' || event.type === 'error') {
              throw new Error(event.error?.code ?? event.response?.error?.code ?? 'provider_stream_failed');
            }
          }
          if (done) break;
        }
        if (!output.trim()) throw new Error('empty_provider_response');

        const usage = completedResponse?.usage;
        const tools = countTools(completedResponse);
        const complete = await serviceClient.rpc('complete_jela_chat_request', {
          p_user_id: userData.user.id,
          p_request_id: idempotencyKey,
          p_content: output,
          p_input_tokens: usage?.input_tokens ?? 0,
          p_cached_input_tokens: usage?.input_tokens_details?.cached_tokens ?? 0,
          p_output_tokens: usage?.output_tokens ?? 0,
          p_provider_request_id: completedResponse?.id ?? '',
          p_tool_calls: tools.toolCalls,
          p_web_search_count: tools.webSearchCount,
          p_file_operation_count: tools.fileOperationCount,
          p_image_operation_count: tools.imageOperationCount,
          p_duration_ms: Date.now() - startedAt,
        });
        if (complete.error) throw new Error('usage_settlement_failed');
        controller.enqueue(encoder.encode(eventPayload({
          type: 'done',
          usageAvailable: complete.data?.usage_available ?? true,
          nextFreeResetAt: complete.data?.next_free_reset_at ?? null,
        })));
      } catch (streamError) {
        const code = streamError instanceof Error ? streamError.message : 'provider_stream_failed';
        await serviceClient.rpc('fail_jela_chat_request', {
          p_user_id: userData.user.id,
          p_request_id: idempotencyKey,
          p_error_code: code,
          p_error_message: 'The provider response did not finish.',
          p_partial_content: output,
          p_duration_ms: Date.now() - startedAt,
        });
        controller.enqueue(encoder.encode(eventPayload({
          type: 'error',
          code: 'response_incomplete',
          message: "Jela couldn't complete that response. Your unfinished request was not charged.",
          retryable: true,
        })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(responseStream, { headers: streamHeaders });
});
