import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from '../_shared/http.ts';
import { createEmbedding, createEmbeddings, entitlementLimit, resolveEntitlements, settleMeter, sha256, vectorLiteral } from '../_shared/workspace.ts';

function serviceClient(request: Request) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization') ?? '';
  if (!url || !key || authorization !== `Bearer ${key}`) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function responseText(payload: { output_text?: unknown; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  if (typeof payload.output_text === 'string') return payload.output_text;
  return (payload.output ?? []).flatMap((item) => item.content ?? []).map((content) => content.text ?? '').join('').trim();
}

async function askOpenAI(instructions: string, input: string, maxOutputTokens: number) {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('openai_not_configured');
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const configured = await client.from('jela_model_config').select('model').eq('enabled', true).eq('mode', 'auto').maybeSingle();
  const model = configured.data?.model;
  if (!model) throw new Error('model_not_configured');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, instructions, input, max_output_tokens: maxOutputTokens, store: false }),
  });
  const payload = await response.json() as { output_text?: unknown; output?: Array<{ content?: Array<{ text?: string }> }>; error?: { code?: string } };
  const output = responseText(payload);
  if (!response.ok || !output) throw new Error(payload.error?.code ?? 'openai_failed');
  return output;
}

async function summarize(client: ReturnType<typeof createClient>, job: Record<string, unknown>) {
  const ownerId = String(job.owner_id); const conversationId = String(job.entity_id);
  const current = await client.from('jela_conversation_summaries')
    .select('version,summary,source_message_from,source_message_to,source_message_count')
    .eq('conversation_id', conversationId).eq('owner_id', ownerId)
    .order('version', { ascending: false }).limit(1).maybeSingle();
  let after: string | null = null;
  if (current.data?.source_message_to) {
    const source = await client.from('jela_messages').select('created_at').eq('id', current.data.source_message_to)
      .eq('owner_id', ownerId).maybeSingle();
    after = source.data?.created_at ?? null;
  }
  let messageQuery = client.from('jela_messages').select('id,role,content,created_at').eq('owner_id', ownerId)
    .eq('conversation_id', conversationId).eq('status', 'complete').order('created_at', { ascending: true }).limit(120);
  if (after) messageQuery = messageQuery.gt('created_at', after);
  const messages = await messageQuery;
  if (messages.error || !messages.data?.length) throw messages.error ?? new Error('messages_not_found');
  const transcript = messages.data.map((item) => `${item.role.toUpperCase()}: ${item.content}`).join('\n').slice(-50000);
  const summary = await askOpenAI(
    'Incrementally update this private Jela conversation summary for future context. Preserve active goals, user decisions, constraints, unresolved tasks, and important facts. Remove superseded details and do not add information. Return one cumulative plain-text summary under 4,000 characters.',
    `${current.data?.summary ? `PREVIOUS SUMMARY:\n${current.data.summary}\n\n` : ''}NEW MESSAGES:\n${transcript}`, 1200,
  );
  const stored = await client.from('jela_conversation_summaries').insert({
    conversation_id: conversationId, owner_id: ownerId, summary: summary.slice(0, 20000),
    source_message_from: current.data?.source_message_from ?? messages.data[0].id, source_message_to: messages.data.at(-1)?.id,
    source_message_count: Number(current.data?.source_message_count ?? 0) + messages.data.length,
    version: (current.data?.version ?? 0) + 1,
  });
  if (stored.error) throw stored.error;
}

async function extractMemory(client: ReturnType<typeof createClient>, job: Record<string, unknown>) {
  const ownerId = String(job.owner_id); const messageId = String(job.entity_id);
  const entitlements = await resolveEntitlements(client, ownerId);
  if (entitlements.features.memory_enabled !== true || entitlements.features.auto_memory_enabled !== true) return;
  const preferences = await client.from('jela_user_settings').select('ai_preferences').eq('user_id', ownerId).maybeSingle();
  const aiPreferences = (preferences.data?.ai_preferences ?? {}) as Record<string, unknown>;
  const memorySettings = aiPreferences.memory && typeof aiPreferences.memory === 'object'
    ? aiPreferences.memory as Record<string, unknown> : {};
  if (memorySettings.enabled !== true || memorySettings.remember_useful !== true) return;
  const selected = await client.from('jela_messages').select('id,content,conversation_id').eq('id', messageId)
    .eq('owner_id', ownerId).eq('role', 'user').maybeSingle();
  if (!selected.data) throw new Error('message_not_found');
  const conversation = await client.from('jela_conversations').select('project_id').eq('id', selected.data.conversation_id)
    .eq('owner_id', ownerId).maybeSingle();
  const output = await askOpenAI(
    'Decide whether this user message contains one useful, durable fact or preference worth remembering. Ignore requests, temporary facts, secrets, credentials, health/financial identifiers, and trivial details. Return strict JSON only: {"save":boolean,"scope":"global"|"project","category":"about_you"|"preferences"|"work_business"|"learning"|"project"|"other","content":"concise first-person-neutral fact","importance":1-10}. If unsure set save false.',
    selected.data.content.slice(0, 8000), 350,
  );
  let candidate: { save?: boolean; scope?: string; category?: string; content?: string; importance?: number };
  try { candidate = JSON.parse(output.replace(/^```json\s*|\s*```$/g, '')); } catch { return; }
  if (!candidate.save || typeof candidate.content !== 'string' || candidate.content.trim().length < 4) return;
  const projectId = candidate.scope === 'project' ? conversation.data?.project_id ?? null : null;
  if (candidate.scope === 'project' && !projectId) return;
  if (projectId && (memorySettings.project_memory !== true || entitlements.features.project_memory_enabled !== true)) return;
  const normalized = candidate.content.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const scope = projectId ? 'project' : 'global';
  let existingQuery = client.from('jela_memories').select('id,content,normalized_content')
    .eq('owner_id', ownerId).eq('scope', scope).is('deleted_at', null);
  existingQuery = projectId ? existingQuery.eq('project_id', projectId) : existingQuery.is('project_id', null);
  const existing = await existingQuery.order('updated_at', { ascending: false }).limit(60);
  const tokens = new Set(normalized.split(/[^\p{L}\p{N}]+/u).filter((value) => value.length > 2));
  const conflict = (existing.data ?? []).map((memory) => {
    const previousTokens = new Set(String(memory.normalized_content).split(/[^\p{L}\p{N}]+/u).filter((value) => value.length > 2));
    const shared = [...tokens].filter((value) => previousTokens.has(value)).length;
    return { memory, overlap: shared / Math.max(1, Math.min(tokens.size, previousTokens.size)) };
  }).sort((a, b) => b.overlap - a.overlap)[0];
  if (conflict?.overlap >= 0.72) {
    if (String(conflict.memory.normalized_content) === normalized) return;
    const updated = await client.from('jela_memories').update({
      content: candidate.content.trim(), normalized_content: normalized, content_hash: await sha256(normalized),
      category: candidate.category ?? 'other', importance: Math.min(Math.max(Math.floor(candidate.importance ?? 5), 1), 10),
      source_message_id: messageId, embedding: null, embedding_model: null, embedding_status: 'pending',
    }).eq('id', conflict.memory.id).eq('owner_id', ownerId).select('id').single();
    if (updated.error) throw updated.error;
    const queued = await client.from('jela_workspace_jobs').insert({ owner_id: ownerId, job_type: 'memory_embed', entity_type: 'memory', entity_id: updated.data.id });
    if (queued.error && !queued.error.message.includes('duplicate key')) throw queued.error;
    return;
  }
  const created = await client.rpc('create_jela_memory', {
    p_user_id: ownerId, p_scope: projectId ? 'project' : 'global', p_project_id: projectId,
    p_conversation_id: null, p_category: candidate.category ?? 'other', p_content: candidate.content.trim(),
    p_content_hash: await sha256(normalized), p_importance: Math.min(Math.max(Math.floor(candidate.importance ?? 5), 1), 10),
    p_source_type: 'conversation', p_source_message_id: messageId,
    p_limit: entitlementLimit(entitlements, 'memory_item_limit'),
  });
  if (created.error || !created.data) {
    if (created.error?.message.includes('memory_limit_reached')) return;
    throw created.error ?? new Error('memory_create_failed');
  }
  const queued = await client.from('jela_workspace_jobs').insert({ owner_id: ownerId, job_type: 'memory_embed', entity_type: 'memory', entity_id: created.data.id });
  if (queued.error && !queued.error.message.includes('duplicate key')) throw queued.error;
}

function chunkText(input: string) {
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < input.length && chunks.length < 400) {
    let end = Math.min(input.length, cursor + 3200);
    if (end < input.length) {
      const boundary = Math.max(input.lastIndexOf('\n', end), input.lastIndexOf('. ', end));
      if (boundary > cursor + 1760) end = boundary + 1;
    }
    const chunk = input.slice(cursor, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= input.length) break;
    cursor = Math.max(cursor + 1, end - 320);
  }
  return chunks;
}

async function extractPdf(bytes: Uint8Array) {
  const pdfjs = await import('npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: bytes, disableWorker: true, isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item: { str?: string }) => item.str ?? '').join(' ').replace(/\s+/g, ' ').trim();
    if (text) pages.push(`[Page ${pageNumber}]\n${text}`);
  }
  await document.destroy();
  return pages.join('\n\n');
}

async function embedMemory(client: ReturnType<typeof createClient>, job: Record<string, unknown>) {
  const ownerId = String(job.owner_id); const memoryId = String(job.entity_id);
  const selected = await client.from('jela_memories').select('id,content').eq('id', memoryId).eq('owner_id', ownerId)
    .is('deleted_at', null).maybeSingle();
  if (!selected.data) return;
  const embedding = await createEmbedding(selected.data.content);
  const updated = await client.from('jela_memories').update({
    embedding: vectorLiteral(embedding), embedding_model: 'text-embedding-3-small', embedding_status: 'ready',
  }).eq('id', memoryId).eq('owner_id', ownerId).is('deleted_at', null);
  if (updated.error) throw updated.error;
}

async function extractFile(client: ReturnType<typeof createClient>, job: Record<string, unknown>) {
  const ownerId = String(job.owner_id); const fileId = String(job.entity_id);
  const entitlements = await resolveEntitlements(client, ownerId);
  if (entitlements.features.workspace_files_enabled !== true || entitlements.features.file_analysis_enabled !== true
    || entitlements.features.document_processing_enabled !== true) throw new Error('file_processing_disabled');
  const selected = await client.from('jela_files').select('*').eq('id', fileId).eq('owner_id', ownerId)
    .is('deleted_at', null).maybeSingle();
  if (!selected.data) return;
  const file = selected.data;
  const downloaded = await client.storage.from('jela-workspace-files').download(file.storage_path);
  if (downloaded.error || !downloaded.data) throw new Error('file_download_failed');
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  if (file.reserved_bytes > 0 && bytes.byteLength > file.reserved_bytes) {
    await client.storage.from('jela-workspace-files').remove([file.storage_path]);
    if (file.reserved_meter_id) await settleMeter(client, file.reserved_meter_id, file.reserved_bytes, 0);
    await client.from('jela_files').update({
      status: 'unable_to_process', reserved_bytes: 0, extraction_error: 'Uploaded size did not match the authorized file size.',
    }).eq('id', fileId).eq('owner_id', ownerId);
    return;
  }
  const content = file.mime_type === 'application/pdf'
    ? await extractPdf(bytes)
    : new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n/g, '\n').trim();
  if (!content.trim()) throw new Error('empty_or_image_only_document');
  const parts = chunkText(content);
  if (!parts.length) throw new Error('empty_document');
  const embeddings: number[][] = [];
  for (let index = 0; index < parts.length; index += 32) {
    embeddings.push(...await createEmbeddings(parts.slice(index, index + 32)));
  }
  const records = await Promise.all(parts.map(async (part, index) => ({
    file_id: fileId, owner_id: ownerId, project_id: file.project_id, chunk_index: index,
    content: part, token_estimate: Math.ceil(part.length / 4), content_hash: await sha256(part),
    embedding: vectorLiteral(embeddings[index]), embedding_model: 'text-embedding-3-small', embedding_status: 'ready',
    metadata: { filename: file.original_name, mime_type: file.mime_type },
  })));
  const removed = await client.from('jela_document_chunks').delete().eq('file_id', fileId).eq('owner_id', ownerId);
  if (removed.error) throw removed.error;
  for (let index = 0; index < records.length; index += 100) {
    const inserted = await client.from('jela_document_chunks').insert(records.slice(index, index + 100));
    if (inserted.error) throw inserted.error;
  }
  if (file.reserved_meter_id && file.reserved_bytes > 0) {
    await settleMeter(client, file.reserved_meter_id, file.reserved_bytes, bytes.byteLength);
  }
  const ready = await client.from('jela_files').update({
    status: 'ready', size_bytes: bytes.byteLength, reserved_bytes: 0, content_hash: await sha256(bytes), extraction_error: null,
  }).eq('id', fileId).eq('owner_id', ownerId);
  if (ready.error) throw ready.error;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  const client = serviceClient(request);
  if (!client) return jsonResponse(401, { code: 'service_role_required', message: 'Worker authorization is required.' });
  const workerId = `edge-${crypto.randomUUID()}`;
  let processed = 0;
  for (let index = 0; index < 3; index += 1) {
    const claimed = await client.rpc('claim_jela_workspace_job', { p_worker: workerId });
    const job = claimed.data as Record<string, unknown> | null;
    if (claimed.error) return jsonResponse(500, { code: 'claim_failed', message: 'The workspace queue is unavailable.' });
    if (!job?.id) break;
    try {
      if (job.job_type === 'conversation_summarize') await summarize(client, job);
      else if (job.job_type === 'memory_extract') await extractMemory(client, job);
      else if (job.job_type === 'memory_embed') await embedMemory(client, job);
      else if (job.job_type === 'file_extract' || job.job_type === 'file_embed') await extractFile(client, job);
      else throw new Error('unsupported_job_type');
      await client.from('jela_workspace_jobs').update({ status: 'completed', completed_at: new Date().toISOString(), last_error: null }).eq('id', job.id);
      processed += 1;
    } catch (error) {
      const attempts = Number(job.attempts ?? 1); const maxAttempts = Number(job.max_attempts ?? 5);
      const exhausted = attempts >= maxAttempts;
      const retryDelayMs = Math.min(32, 2 ** attempts) * 1000;
      await client.from('jela_workspace_jobs').update({
        status: exhausted ? 'failed' : 'queued', locked_at: null, locked_by: null,
        run_after: new Date(Date.now() + retryDelayMs).toISOString(),
        last_error: error instanceof Error ? error.message.slice(0, 500) : 'job_failed',
      }).eq('id', job.id);
      if (exhausted && (job.job_type === 'file_extract' || job.job_type === 'file_embed')) {
        const file = await client.from('jela_files').select('reserved_meter_id,reserved_bytes,size_bytes').eq('id', String(job.entity_id))
          .eq('owner_id', String(job.owner_id)).maybeSingle();
        if (file.data?.reserved_meter_id && file.data.reserved_bytes > 0) {
          await settleMeter(client, file.data.reserved_meter_id, file.data.reserved_bytes, file.data.size_bytes).catch(() => undefined);
        }
        await client.from('jela_files').update({
          status: 'unable_to_process', reserved_bytes: 0,
          extraction_error: error instanceof Error ? error.message.slice(0, 300) : 'processing_failed',
        }).eq('id', String(job.entity_id)).eq('owner_id', String(job.owner_id));
      } else if (exhausted && job.job_type === 'memory_embed') {
        await client.from('jela_memories').update({ embedding_status: 'failed' }).eq('id', String(job.entity_id))
          .eq('owner_id', String(job.owner_id));
      }
      if (!exhausted) {
        const url = Deno.env.get('SUPABASE_URL');
        const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (url && key) {
          const retry = new Promise((resolve) => setTimeout(resolve, retryDelayMs)).then(() => fetch(
            `${url}/functions/v1/jela-workspace-worker`,
            { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}' },
          )).catch(() => undefined);
          const runtime = (globalThis as typeof globalThis & { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
          runtime?.waitUntil(retry);
        }
      }
    }
  }
  if (processed === 3) {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      const drain = fetch(`${url}/functions/v1/jela-workspace-worker`, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}',
      }).catch(() => undefined);
      const runtime = (globalThis as typeof globalThis & { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
      runtime?.waitUntil(drain);
    }
  }
  return jsonResponse(200, { processed });
});
