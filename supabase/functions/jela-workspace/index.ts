import { corsHeaders, jsonResponse, verifiedUser } from '../_shared/http.ts';
import {
  entitlementLimit, requireFeature, resolveEntitlements, settleMeter, sha256,
} from '../_shared/workspace.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories = new Set(['about_you', 'preferences', 'work_business', 'learning', 'project', 'other']);
const scopes = new Set(['global', 'project', 'conversation']);
const text = (input: unknown, max: number) => typeof input === 'string' ? input.trim().slice(0, max) : '';
const optionalUuid = (input: unknown) => input === null || input === undefined || input === ''
  ? null : typeof input === 'string' && uuidPattern.test(input) ? input : undefined;

function publicError(error: unknown) {
  const raw = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : '';
  const mappings: Array<[string, number, string, string]> = [
    ['projects_enabled_unavailable', 503, 'projects_unavailable', 'Projects are not available right now.'],
    ['workspace_files_enabled_unavailable', 503, 'files_unavailable', 'Workspace files are not available right now.'],
    ['file_analysis_enabled_unavailable', 503, 'file_analysis_unavailable', 'File analysis is not available right now.'],
    ['document_processing_enabled_unavailable', 503, 'file_processing_unavailable', 'File processing is temporarily unavailable.'],
    ['memory_enabled_unavailable', 503, 'memory_unavailable', 'Memory is not available right now.'],
    ['project_limit_reached', 429, 'project_limit_reached', 'Project limit reached. Existing projects remain available.'],
    ['memory_limit_reached', 429, 'memory_limit_reached', 'Memory limit reached. Manage memories or upgrade your plan.'],
    ['storage_bytes_limit_reached', 429, 'storage_limit_reached', 'Storage limit reached. Existing files remain available.'],
    ['project_file_limit_reached', 429, 'project_file_limit_reached', 'This project has reached its file limit. Existing files remain available.'],
    ['project_not_found', 404, 'project_not_found', 'That project is unavailable.'],
    ['file_not_found', 404, 'file_not_found', 'That file is unavailable.'],
    ['invalid_project_name', 400, 'invalid_project_name', 'Use a project name between 1 and 100 characters.'],
    ['invalid_file', 400, 'invalid_file', 'Choose a supported text file within your plan limit.'],
    ['embedding_not_configured', 503, 'workspace_ai_unavailable', 'Workspace search is temporarily unavailable.'],
  ];
  const match = mappings.find(([needle]) => raw.includes(needle));
  return match ? jsonResponse(match[1], { code: match[2], message: match[3] })
    : jsonResponse(500, { code: 'workspace_failed', message: 'The workspace request could not be completed.' });
}

async function triggerWorker(client: SupabaseClient) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return;
  const pending = fetch(`${url}/functions/v1/jela-workspace-worker`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}',
  }).catch(() => undefined);
  const runtime = (globalThis as typeof globalThis & { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime) runtime.waitUntil(pending); else await pending;
  void client;
}

async function enqueueJob(
  client: SupabaseClient, ownerId: string, jobType: 'memory_embed' | 'file_extract', entityType: string, entityId: string,
) {
  const active = await client.from('jela_workspace_jobs').select('id').eq('job_type', jobType).eq('entity_id', entityId)
    .in('status', ['queued', 'processing']).maybeSingle();
  if (active.error) throw active.error;
  if (!active.data) {
    const queued = await client.from('jela_workspace_jobs').insert({ owner_id: ownerId, job_type: jobType, entity_type: entityType, entity_id: entityId });
    if (queued.error) throw queued.error;
  }
  await triggerWorker(client);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  const auth = await verifiedUser(request);
  if (auth instanceof Response) return auth;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return jsonResponse(400, { code: 'invalid_request', message: 'The request body is invalid.' });
  }
  const action = text(body.action, 80);
  const client = auth.serviceClient;
  try {
    const entitlements = await resolveEntitlements(client, auth.user.id);
    if (action === 'entitlements') return jsonResponse(200, { entitlements });

    if (action === 'list_projects') {
      requireFeature(entitlements, 'projects_enabled');
      const offset = Math.max(Number(body.offset) || 0, 0);
      const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 100);
      let query = client.from('jela_projects').select('*').eq('owner_id', auth.user.id).is('deleted_at', null)
        .order('last_activity_at', { ascending: false }).range(offset, offset + limit);
      query = body.archived === true ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
      const result = await query;
      if (result.error) throw result.error;
      return jsonResponse(200, { projects: result.data.slice(0, limit), hasMore: result.data.length > limit });
    }
    if (action === 'get_project') {
      requireFeature(entitlements, 'projects_enabled');
      const projectId = optionalUuid(body.projectId);
      const result = projectId ? await client.from('jela_projects').select('*').eq('id', projectId).eq('owner_id', auth.user.id)
        .is('deleted_at', null).maybeSingle() : null;
      if (!result?.data) throw new Error('project_not_found');
      return jsonResponse(200, { project: result.data });
    }
    if (action === 'create_project') {
      requireFeature(entitlements, 'projects_enabled');
      const result = await client.rpc('create_jela_project', {
        p_user_id: auth.user.id, p_name: text(body.name, 100), p_description: text(body.description, 1000),
        p_instructions: text(body.instructions, 8000), p_limit: entitlementLimit(entitlements, 'max_projects'),
      });
      if (result.error) throw result.error;
      return jsonResponse(200, { project: result.data });
    }
    if (['update_project', 'archive_project', 'restore_project'].includes(action)) {
      requireFeature(entitlements, 'projects_enabled');
      const id = optionalUuid(body.projectId);
      if (!id) throw new Error('project_not_found');
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString() };
      if (action === 'archive_project') patch.archived_at = new Date().toISOString();
      else if (action === 'restore_project') patch.archived_at = null;
      else {
        if (!text(body.name, 100)) throw new Error('invalid_project_name');
        Object.assign(patch, { name: text(body.name, 100), description: text(body.description, 1000) || null, instructions: text(body.instructions, 8000) || null });
      }
      const result = await client.from('jela_projects').update(patch).eq('id', id).eq('owner_id', auth.user.id)
        .is('deleted_at', null).select('*').maybeSingle();
      if (result.error || !result.data) throw new Error('project_not_found');
      return jsonResponse(200, { project: result.data });
    }
    if (action === 'delete_project') {
      const id = optionalUuid(body.projectId);
      if (!id || body.confirmation !== 'DELETE') return jsonResponse(400, { code: 'confirmation_required', message: 'Type DELETE to remove this project.' });
      const owned = await client.from('jela_projects').select('id').eq('id', id).eq('owner_id', auth.user.id).maybeSingle();
      if (!owned.data) throw new Error('project_not_found');
      const files = await client.from('jela_files').select('*').eq('owner_id', auth.user.id).eq('project_id', id).is('deleted_at', null);
      for (const file of files.data ?? []) {
        await client.storage.from('jela-workspace-files').remove([file.storage_path]);
        if (file.reserved_meter_id) {
          if (file.reserved_bytes > 0) await settleMeter(client, file.reserved_meter_id, file.reserved_bytes, 0);
          else await client.rpc('adjust_jela_meter', { p_meter_id: file.reserved_meter_id, p_used_delta: -file.size_bytes });
        }
      }
      const removed = await client.from('jela_projects').delete().eq('id', id).eq('owner_id', auth.user.id);
      if (removed.error) throw removed.error;
      return jsonResponse(200, { deleted: true, conversationsDetached: true });
    }
    if (action === 'create_project_conversation') {
      const projectId = optionalUuid(body.projectId);
      if (!projectId) throw new Error('project_not_found');
      const owned = await client.from('jela_projects').select('id').eq('id', projectId).eq('owner_id', auth.user.id).is('deleted_at', null).maybeSingle();
      if (!owned.data) throw new Error('project_not_found');
      const created = await client.from('jela_conversations').insert({ owner_id: auth.user.id, project_id: projectId, title: text(body.title, 120) || 'New project chat' })
        .select('id').single();
      if (created.error) throw created.error;
      return jsonResponse(200, { conversationId: created.data.id });
    }

    if (action === 'list_memories') {
      requireFeature(entitlements, 'memory_enabled');
      const projectId = optionalUuid(body.projectId);
      const offset = Math.max(Number(body.offset) || 0, 0);
      const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 100);
      let query = client.from('jela_memories').select('id,scope,project_id,conversation_id,category,content,importance,pinned,source_type,created_at,updated_at')
        .eq('owner_id', auth.user.id).is('deleted_at', null).order('pinned', { ascending: false }).order('updated_at', { ascending: false })
        .range(offset, offset + limit);
      if (projectId) query = query.eq('project_id', projectId);
      else query = query.eq('scope', 'global');
      const result = await query;
      if (result.error) throw result.error;
      return jsonResponse(200, { memories: result.data.slice(0, limit), hasMore: result.data.length > limit });
    }
    if (action === 'create_memory') {
      requireFeature(entitlements, 'memory_enabled');
      const scope = text(body.scope, 30) || 'global';
      const content = text(body.content, 4000);
      const projectId = optionalUuid(body.projectId);
      const conversationId = optionalUuid(body.conversationId);
      const category = categories.has(text(body.category, 40)) ? text(body.category, 40) : 'other';
      if (!scopes.has(scope) || !content || projectId === undefined || conversationId === undefined) {
        return jsonResponse(400, { code: 'invalid_memory', message: 'Check the memory content and scope.' });
      }
      const hash = await sha256(content.toLocaleLowerCase().replace(/\s+/g, ' ').trim());
      const created = await client.rpc('create_jela_memory', {
        p_user_id: auth.user.id, p_scope: scope, p_project_id: projectId, p_conversation_id: conversationId,
        p_category: category, p_content: content, p_content_hash: hash, p_importance: 5,
        p_source_type: 'manual', p_source_message_id: null, p_limit: entitlementLimit(entitlements, 'memory_item_limit'),
      });
      if (created.error || !created.data) throw created.error ?? new Error('memory_create_failed');
      await enqueueJob(client, auth.user.id, 'memory_embed', 'memory', created.data.id);
      return jsonResponse(200, { memory: created.data });
    }
    if (['update_memory', 'pin_memory', 'delete_memory'].includes(action)) {
      const id = optionalUuid(body.memoryId);
      if (!id) return jsonResponse(404, { code: 'memory_not_found', message: 'That memory is unavailable.' });
      if (action === 'delete_memory') {
        const result = await client.from('jela_memories').update({ deleted_at: new Date().toISOString(), embedding: null })
          .eq('id', id).eq('owner_id', auth.user.id).is('deleted_at', null).select('id').maybeSingle();
        if (!result.data) return jsonResponse(404, { code: 'memory_not_found', message: 'That memory is unavailable.' });
        return jsonResponse(200, { deleted: true });
      }
      if (action === 'pin_memory') {
        const result = await client.from('jela_memories').update({ pinned: body.pinned === true }).eq('id', id).eq('owner_id', auth.user.id)
          .is('deleted_at', null).select('*').maybeSingle();
        if (!result.data) return jsonResponse(404, { code: 'memory_not_found', message: 'That memory is unavailable.' });
        return jsonResponse(200, { memory: result.data });
      }
      const content = text(body.content, 4000);
      if (!content) return jsonResponse(400, { code: 'invalid_memory', message: 'Memory content cannot be empty.' });
      const result = await client.from('jela_memories').update({
        content, normalized_content: content.toLocaleLowerCase().replace(/\s+/g, ' ').trim(),
        content_hash: await sha256(content.toLocaleLowerCase().replace(/\s+/g, ' ').trim()),
        category: categories.has(text(body.category, 40)) ? text(body.category, 40) : 'other',
        embedding: null, embedding_model: null, embedding_status: 'pending',
      }).eq('id', id).eq('owner_id', auth.user.id).is('deleted_at', null).select('*').maybeSingle();
      if (!result.data) return jsonResponse(404, { code: 'memory_not_found', message: 'That memory is unavailable.' });
      await enqueueJob(client, auth.user.id, 'memory_embed', 'memory', id);
      return jsonResponse(200, { memory: result.data });
    }
    if (action === 'clear_memories') {
      if (body.confirmation !== 'FORGET') return jsonResponse(400, { code: 'confirmation_required', message: 'Type FORGET to clear Jela memory.' });
      const result = await client.from('jela_memories').update({ deleted_at: new Date().toISOString(), embedding: null })
        .eq('owner_id', auth.user.id).is('deleted_at', null);
      if (result.error) throw result.error;
      return jsonResponse(200, { cleared: true });
    }
    if (action === 'memory_settings') {
      const existing = await client.from('jela_user_settings').select('ai_preferences').eq('user_id', auth.user.id).maybeSingle();
      const preferences = (existing.data?.ai_preferences ?? {}) as Record<string, unknown>;
      if (body.settings && typeof body.settings === 'object') {
        const incoming = body.settings as Record<string, unknown>;
        const settings = { enabled: incoming.enabled !== false, remember_useful: incoming.rememberUseful !== false,
          reference_conversations: incoming.referenceConversations !== false, project_memory: incoming.projectMemory !== false,
          onboarded: incoming.onboarded === true };
        const updated = await client.rpc('set_jela_memory_settings', { p_user_id: auth.user.id, p_settings: settings });
        if (updated.error) throw updated.error;
        return jsonResponse(200, { settings: updated.data });
      }
      return jsonResponse(200, { settings: preferences.memory ?? { enabled: false, remember_useful: false, reference_conversations: false, project_memory: false, onboarded: false } });
    }

    if (action === 'init_file') {
      requireFeature(entitlements, 'workspace_files_enabled');
      const projectId = optionalUuid(body.projectId);
      const name = text(body.name, 255);
      const mimeType = text(body.mimeType, 100);
      const size = Math.floor(Number(body.size));
      const maxFileSize = entitlementLimit(entitlements, 'max_file_size');
      if (!name || !['text/plain', 'application/pdf'].includes(mimeType) || !Number.isFinite(size) || size < 1 || size > maxFileSize || projectId === undefined) throw new Error('invalid_file');
      const fileId = crypto.randomUUID();
      const path = `${auth.user.id}/${projectId ?? 'global'}/${fileId}.${mimeType === 'application/pdf' ? 'pdf' : 'txt'}`;
      const record = await client.rpc('create_jela_file_record', {
        p_user_id: auth.user.id, p_file_id: fileId, p_project_id: projectId, p_original_name: name,
        p_storage_path: path, p_mime_type: mimeType, p_size_bytes: size,
        p_storage_limit: entitlementLimit(entitlements, 'storage_bytes_limit'),
        p_project_file_limit: entitlementLimit(entitlements, 'max_project_files'),
      });
      if (record.error || !record.data) throw record.error ?? new Error('file_create_failed');
      const signed = await client.storage.from('jela-workspace-files').createSignedUploadUrl(path);
      if (signed.error) {
        await client.from('jela_files').delete().eq('id', fileId);
        await settleMeter(client, record.data.reserved_meter_id, size, 0);
        throw signed.error;
      }
      return jsonResponse(200, { file: record.data, upload: { path, token: signed.data.token } });
    }
    if (action === 'process_file' || action === 'reprocess_file') {
      requireFeature(entitlements, 'workspace_files_enabled');
      requireFeature(entitlements, 'file_analysis_enabled');
      requireFeature(entitlements, 'document_processing_enabled');
      const fileId = optionalUuid(body.fileId);
      const selected = fileId ? await client.from('jela_files').select('*').eq('id', fileId).eq('owner_id', auth.user.id).is('deleted_at', null).maybeSingle() : null;
      if (!selected?.data) throw new Error('file_not_found');
      if (selected.data.status === 'ready' && action !== 'reprocess_file') return jsonResponse(200, { file: selected.data, replay: true });
      const processing = await client.from('jela_files').update({ status: 'processing', extraction_error: null }).eq('id', fileId).select('*').single();
      if (processing.error) throw processing.error;
      await enqueueJob(client, auth.user.id, 'file_extract', 'file', fileId);
      return jsonResponse(200, { file: processing.data, queued: true });
    }
    if (action === 'list_files') {
      requireFeature(entitlements, 'workspace_files_enabled');
      const projectId = optionalUuid(body.projectId);
      const offset = Math.max(Number(body.offset) || 0, 0);
      const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 100);
      let query = client.from('jela_files').select('id,project_id,original_name,mime_type,size_bytes,status,extraction_error,created_at,updated_at')
        .eq('owner_id', auth.user.id).is('deleted_at', null).order('updated_at', { ascending: false }).range(offset, offset + limit);
      if (projectId) query = query.eq('project_id', projectId);
      const result = await query;
      if (result.error) throw result.error;
      return jsonResponse(200, { files: result.data.slice(0, limit), hasMore: result.data.length > limit });
    }
    if (action === 'delete_file') {
      const fileId = optionalUuid(body.fileId);
      const selected = fileId ? await client.from('jela_files').select('*').eq('id', fileId).eq('owner_id', auth.user.id).is('deleted_at', null).maybeSingle() : null;
      if (!selected?.data) throw new Error('file_not_found');
      await client.storage.from('jela-workspace-files').remove([selected.data.storage_path]);
      await client.from('jela_files').delete().eq('id', fileId).eq('owner_id', auth.user.id);
      if (selected.data.reserved_meter_id) {
        if (selected.data.reserved_bytes > 0) await settleMeter(client, selected.data.reserved_meter_id, selected.data.reserved_bytes, 0);
        else await client.rpc('adjust_jela_meter', { p_meter_id: selected.data.reserved_meter_id, p_used_delta: -selected.data.size_bytes });
      }
      return jsonResponse(200, { deleted: true });
    }

    if (action === 'delete_generated_image') {
      const imageId = optionalUuid(body.imageId);
      if (!imageId || body.confirmation !== 'DELETE') return jsonResponse(400, { code: 'confirmation_required', message: 'Confirm image deletion.' });
      const selected = await client.from('jela_generated_images').select('id,message_id,storage_path')
        .eq('id', imageId).eq('owner_id', auth.user.id).maybeSingle();
      if (!selected.data) return jsonResponse(404, { code: 'image_not_found', message: 'That image is unavailable.' });
      const removedStorage = await client.storage.from('jela-generated-images').remove([selected.data.storage_path]);
      if (removedStorage.error) throw removedStorage.error;
      const removed = await client.from('jela_generated_images').delete().eq('id', imageId).eq('owner_id', auth.user.id);
      if (removed.error) throw removed.error;
      if (selected.data.message_id) {
        await client.from('jela_messages').update({ content: 'Generated image deleted by user', metadata: { kind: 'generated_image_deleted' } })
          .eq('id', selected.data.message_id).eq('owner_id', auth.user.id);
      }
      return jsonResponse(200, { deleted: true });
    }

    if (action === 'delete_conversation') {
      const conversationId = optionalUuid(body.conversationId);
      if (!conversationId || body.confirmation !== 'DELETE') return jsonResponse(400, { code: 'confirmation_required', message: 'Confirm conversation deletion.' });
      const owned = await client.from('jela_conversations').select('id').eq('id', conversationId).eq('owner_id', auth.user.id).maybeSingle();
      if (!owned.data) return jsonResponse(404, { code: 'conversation_not_found', message: 'That conversation is unavailable.' });
      const [attachments, images] = await Promise.all([
        client.from('jela_attachments').select('storage_path').eq('conversation_id', conversationId).eq('owner_id', auth.user.id),
        client.from('jela_generated_images').select('storage_path').eq('conversation_id', conversationId).eq('owner_id', auth.user.id),
      ]);
      const attachmentPaths = (attachments.data ?? []).map((item) => item.storage_path).filter(Boolean);
      const imagePaths = (images.data ?? []).map((item) => item.storage_path).filter(Boolean);
      if (attachmentPaths.length) {
        const removed = await client.storage.from('jela-attachments').remove(attachmentPaths);
        if (removed.error) throw removed.error;
      }
      if (imagePaths.length) {
        const removed = await client.storage.from('jela-generated-images').remove(imagePaths);
        if (removed.error) throw removed.error;
      }
      const deleted = await client.from('jela_conversations').delete().eq('id', conversationId).eq('owner_id', auth.user.id);
      if (deleted.error) throw deleted.error;
      return jsonResponse(200, { deleted: true });
    }

    if (action === 'search') {
      const query = text(body.query, 300);
      if (query.length < 2) return jsonResponse(200, { results: { chats: [], projects: [], files: [], memories: [], images: [] } });
      const pattern = `%${query.replace(/[%_]/g, '\\$&')}%`;
      const [chats, projects, files, memories, images] = await Promise.all([
        client.from('jela_conversations').select('id,title,updated_at,project_id').eq('owner_id', auth.user.id).ilike('title', pattern).limit(12),
        client.from('jela_projects').select('id,name,description,updated_at').eq('owner_id', auth.user.id).is('deleted_at', null).or(`name.ilike.${pattern},description.ilike.${pattern}`).limit(12),
        client.from('jela_files').select('id,original_name,status,project_id,updated_at').eq('owner_id', auth.user.id).is('deleted_at', null).ilike('original_name', pattern).limit(12),
        client.from('jela_memories').select('id,content,category,scope,project_id,updated_at').eq('owner_id', auth.user.id).is('deleted_at', null).ilike('content', pattern).limit(12),
        client.from('jela_generated_images').select('id,prompt,conversation_id,project_id,created_at').eq('owner_id', auth.user.id).eq('status', 'ready').ilike('prompt', pattern).limit(12),
      ]);
      return jsonResponse(200, { results: { chats: chats.data ?? [], projects: projects.data ?? [], files: files.data ?? [], memories: memories.data ?? [], images: images.data ?? [] } });
    }
    if (action === 'usage') {
      const [projects, memories, files, meters] = await Promise.all([
        client.from('jela_projects').select('id', { count: 'exact', head: true }).eq('owner_id', auth.user.id).is('deleted_at', null),
        client.from('jela_memories').select('id', { count: 'exact', head: true }).eq('owner_id', auth.user.id).is('deleted_at', null),
        client.from('jela_files').select('size_bytes').eq('owner_id', auth.user.id).is('deleted_at', null),
        client.from('jela_usage_meters').select('meter_key,used,reserved,period_start,period_end').eq('owner_id', auth.user.id)
          .gt('period_end', new Date().toISOString()).order('period_start', { ascending: false }).limit(20),
      ]);
      return jsonResponse(200, { entitlements, usage: { projects: projects.count ?? 0, memories: memories.count ?? 0,
        storageBytes: (files.data ?? []).reduce((sum, file) => sum + Number(file.size_bytes), 0), meters: meters.data ?? [] } });
    }
    return jsonResponse(400, { code: 'unknown_action', message: 'That workspace action is not supported.' });
  } catch (error) { return publicError(error); }
});
