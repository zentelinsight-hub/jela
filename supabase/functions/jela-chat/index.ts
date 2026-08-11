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

type BeginResult = {
  replay: boolean;
  status: 'processing' | 'complete' | 'failed';
  conversation_id: string;
  user_message_id: string;
  assistant_message_id: string;
  assistant_content?: string;
  provider?: string;
  model?: string;
  system_prompt?: string;
  max_output_tokens?: number;
};

type OpenAIEvent = {
  type?: string;
  delta?: string;
  error?: { code?: string; message?: string };
  response?: {
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { code?: string; message?: string };
  };
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function publicError(message: string) {
  const mappings: Record<string, { status: number; code: string; message: string }> = {
    account_unavailable: { status: 403, code: 'account_unavailable', message: 'This account cannot use Jela AI right now.' },
    chat_not_enabled: { status: 503, code: 'chat_not_enabled', message: 'AI chat has not been enabled by Jela AI yet.' },
    model_not_configured: { status: 503, code: 'model_not_configured', message: 'The production AI model is not configured yet.' },
    insufficient_credits: { status: 402, code: 'insufficient_credits', message: 'You do not have enough available credits for this request.' },
    conversation_not_found: { status: 404, code: 'conversation_not_found', message: 'This conversation is unavailable.' },
    invalid_message: { status: 400, code: 'invalid_message', message: 'Write a message between 1 and 8,000 characters.' },
    invalid_attachment: { status: 400, code: 'invalid_attachment', message: 'One or more attachments are unavailable.' },
    attachments_not_enabled: { status: 503, code: 'attachments_not_enabled', message: 'Attachments are not enabled.' },
    too_many_attachments: { status: 400, code: 'too_many_attachments', message: 'Attach no more than five files.' },
    idempotency_conflict: { status: 409, code: 'idempotency_conflict', message: 'This request identifier belongs to another operation.' },
  };
  const match = Object.entries(mappings).find(([key]) => message.includes(key));
  return match?.[1] ?? { status: 500, code: 'request_failed', message: 'Jela AI could not start this request.' };
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
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(503, { code: 'backend_not_configured', message: 'The Jela AI backend is not configured.' });
  }
  if (!openAIKey) {
    return jsonResponse(503, { code: 'provider_not_configured', message: 'The production AI provider is not configured yet.' });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse(401, { code: 'invalid_session', message: 'Your session expired. Sign in again.' });
  }

  let body: { message?: unknown; conversation_id?: unknown; attachment_ids?: unknown };
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
  const attachmentIds = Array.isArray(body.attachment_ids)
    ? body.attachment_ids.filter((value): value is string => typeof value === 'string' && uuidPattern.test(value))
    : [];
  if (!message || message.length > 8000 || conversationId === undefined) {
    return jsonResponse(400, { code: 'invalid_request', message: 'Check the conversation and message, then try again.' });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const begin = await serviceClient.rpc('begin_jela_chat_request', {
    p_user_id: userData.user.id,
    p_request_id: idempotencyKey,
    p_conversation_id: conversationId,
    p_message: message,
    p_attachment_ids: attachmentIds,
  });
  if (begin.error) {
    const error = publicError(begin.error.message);
    return jsonResponse(error.status, error);
  }

  const context = begin.data as BeginResult;
  const acceptedEvent = {
    type: 'accepted',
    conversationId: context.conversation_id,
    userMessageId: context.user_message_id,
    assistantMessageId: context.assistant_message_id,
  };
  if (context.replay && context.status === 'complete') {
    const replayStream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(eventPayload(acceptedEvent)));
        if (context.assistant_content) {
          controller.enqueue(encoder.encode(eventPayload({ type: 'delta', delta: context.assistant_content })));
        }
        controller.enqueue(encoder.encode(eventPayload({ type: 'done' })));
        controller.close();
      },
    });
    return new Response(replayStream, { headers: streamHeaders });
  }
  if (context.replay && context.status === 'processing') {
    return jsonResponse(409, {
      code: 'request_in_progress',
      message: 'This request is already being processed. Wait a moment and retry safely.',
    });
  }
  if (context.provider !== 'openai' || !context.model || !context.max_output_tokens) {
    await serviceClient.rpc('fail_jela_chat_request', {
      p_user_id: userData.user.id,
      p_request_id: idempotencyKey,
      p_error_code: 'invalid_model_config',
      p_error_message: 'The selected model configuration is incomplete.',
      p_partial_content: '',
    });
    return jsonResponse(503, { code: 'model_not_configured', message: 'The production AI model is not configured correctly.' });
  }

  const historyResult = await serviceClient
    .from('jela_messages')
    .select('role,content')
    .eq('conversation_id', context.conversation_id)
    .in('role', ['user', 'assistant'])
    .eq('status', 'complete')
    .order('created_at', { ascending: true })
    .limit(80);
  if (historyResult.error) {
    await serviceClient.rpc('fail_jela_chat_request', {
      p_user_id: userData.user.id,
      p_request_id: idempotencyKey,
      p_error_code: 'history_failed',
      p_error_message: 'Conversation history could not be loaded.',
      p_partial_content: '',
    });
    return jsonResponse(500, { code: 'history_failed', message: 'Jela AI could not load the conversation safely.' });
  }

  const providerResponse = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: context.model,
      instructions: context.system_prompt,
      input: historyResult.data.map((entry) => ({ role: entry.role, content: entry.content })),
      max_output_tokens: context.max_output_tokens,
      stream: true,
      store: false,
      safety_identifier: await safetyIdentifier(userData.user.id),
    }),
  });

  if (!providerResponse.ok || !providerResponse.body) {
    await serviceClient.rpc('fail_jela_chat_request', {
      p_user_id: userData.user.id,
      p_request_id: idempotencyKey,
      p_error_code: `provider_${providerResponse.status}`,
      p_error_message: 'The AI provider rejected the request.',
      p_partial_content: '',
    });
    return jsonResponse(502, { code: 'provider_unavailable', message: 'The AI service is temporarily unavailable. Try again later.' });
  }

  const responseStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const reader = providerResponse.body!.getReader();
      let buffer = '';
      let output = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let failed = false;
      controller.enqueue(encoder.encode(eventPayload(acceptedEvent)));

      try {
        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() ?? '';
          for (const block of blocks) {
            const event = parseSseBlock(block);
            if (!event) continue;
            if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
              output += event.delta;
              controller.enqueue(encoder.encode(eventPayload({ type: 'delta', delta: event.delta })));
            } else if (event.type === 'response.completed') {
              inputTokens = event.response?.usage?.input_tokens ?? 0;
              outputTokens = event.response?.usage?.output_tokens ?? 0;
            } else if (event.type === 'response.failed' || event.type === 'error') {
              failed = true;
              throw new Error(event.error?.code ?? event.response?.error?.code ?? 'provider_stream_failed');
            }
          }
          if (done) break;
        }
        if (!output.trim()) throw new Error('empty_provider_response');

        const complete = await serviceClient.rpc('complete_jela_chat_request', {
          p_user_id: userData.user.id,
          p_request_id: idempotencyKey,
          p_content: output,
          p_input_tokens: inputTokens,
          p_output_tokens: outputTokens,
        });
        if (complete.error) throw new Error('usage_settlement_failed');
        controller.enqueue(encoder.encode(eventPayload({
          type: 'done',
          usage: { inputTokens, outputTokens },
        })));
      } catch (streamError) {
        const code = streamError instanceof Error ? streamError.message : 'provider_stream_failed';
        await serviceClient.rpc('fail_jela_chat_request', {
          p_user_id: userData.user.id,
          p_request_id: idempotencyKey,
          p_error_code: code,
          p_error_message: failed ? 'The AI provider stream failed.' : 'The response could not be settled.',
          p_partial_content: output,
        });
        controller.enqueue(encoder.encode(eventPayload({
          type: 'error',
          code: 'response_incomplete',
          message: 'The response stopped before it finished. Retry safely.',
          retryable: true,
        })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(responseStream, { headers: streamHeaders });
});
