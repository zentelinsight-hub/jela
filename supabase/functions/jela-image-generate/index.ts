import { corsHeaders, jsonResponse, verifiedUser } from '../_shared/http.ts';
import { entitlementLimit, reserveMeter, resolveEntitlements, settleMeter } from '../_shared/workspace.ts';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  const auth = await verifiedUser(request);
  if (auth instanceof Response) return auth;
  const idempotencyKey = request.headers.get('X-Idempotency-Key') ?? '';
  if (!uuidPattern.test(idempotencyKey)) {
    return jsonResponse(400, { code: 'invalid_idempotency_key', message: 'A valid request identifier is required.' });
  }
  let body: { prompt?: unknown; conversationId?: unknown; projectId?: unknown; size?: unknown; quality?: unknown };
  try { body = await request.json(); }
  catch { return jsonResponse(400, { code: 'invalid_request', message: 'Describe the image you want to create.' }); }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const conversationId = body.conversationId === null || body.conversationId === undefined
    ? null : typeof body.conversationId === 'string' && uuidPattern.test(body.conversationId) ? body.conversationId : undefined;
  const projectId = body.projectId === null || body.projectId === undefined
    ? null : typeof body.projectId === 'string' && uuidPattern.test(body.projectId) ? body.projectId : undefined;
  const size = body.size === '1024x1536' || body.size === '1536x1024' ? body.size : '1024x1024';
  const quality = body.quality === 'high' ? 'high' : body.quality === 'low' ? 'low' : 'medium';
  if (!prompt || prompt.length > 4000 || conversationId === undefined || projectId === undefined) {
    return jsonResponse(400, { code: 'invalid_prompt', message: 'Use an image description between 1 and 4,000 characters.' });
  }

  const replay = await auth.serviceClient.from('jela_generated_images')
    .select('id,conversation_id,message_id,storage_path,status,created_at')
    .eq('request_id', idempotencyKey).eq('owner_id', auth.user.id).maybeSingle();
  if (replay.data?.status === 'ready') {
    const signed = await auth.serviceClient.storage.from('jela-generated-images').createSignedUrl(replay.data.storage_path, 3600);
    return jsonResponse(200, { image: { ...replay.data, signedUrl: signed.data?.signedUrl ?? null }, replay: true });
  }
  if (replay.data?.status === 'processing') {
    return jsonResponse(409, { code: 'generation_in_progress', message: 'That image is still being created.' });
  }

  const account = await auth.serviceClient.from('jela_accounts').select('status').eq('id', auth.user.id).maybeSingle();
  if (account.error || account.data?.status !== 'active') {
    return jsonResponse(403, { code: 'account_unavailable', message: 'This account cannot create images right now.' });
  }
  const entitlements = await resolveEntitlements(auth.serviceClient, auth.user.id);
  if (entitlements.features.image_generation_enabled !== true) return jsonResponse(503, { code: 'image_generation_unavailable', message: 'Image creation is temporarily unavailable.' });
  let meterId: string | null = null;

  let selectedConversationId = conversationId;
  let selectedProjectId = projectId;
  if (selectedConversationId) {
    const conversation = await auth.serviceClient.from('jela_conversations').select('id,project_id')
      .eq('id', selectedConversationId).eq('owner_id', auth.user.id).maybeSingle();
    if (!conversation.data || conversation.error) return jsonResponse(404, { code: 'conversation_not_found', message: 'That conversation is unavailable.' });
    selectedProjectId = conversation.data.project_id;
  } else {
    if (selectedProjectId) {
      const project = await auth.serviceClient.from('jela_projects').select('id').eq('id', selectedProjectId)
        .eq('owner_id', auth.user.id).is('deleted_at', null).maybeSingle();
      if (!project.data) return jsonResponse(404, { code: 'project_not_found', message: 'That project is unavailable.' });
    }
    const created = await auth.serviceClient.from('jela_conversations').insert({
      owner_id: auth.user.id, project_id: selectedProjectId,
      title: prompt.length > 70 ? `${prompt.slice(0, 67)}…` : prompt,
    }).select('id').single();
    if (created.error) return jsonResponse(503, { code: 'generation_failed', message: 'The image request could not be prepared.' });
    selectedConversationId = created.data.id;
  }

  const userMessage = await auth.serviceClient.from('jela_messages').insert({
    conversation_id: selectedConversationId,
    owner_id: auth.user.id,
    role: 'user',
    content: prompt,
    status: 'complete',
    request_id: idempotencyKey,
    metadata: { kind: 'image_prompt' },
  }).select('id').single();
  if (userMessage.error) return jsonResponse(409, { code: 'idempotency_conflict', message: 'That request was already submitted.' });
  const assistantMessage = await auth.serviceClient.from('jela_messages').insert({
    conversation_id: selectedConversationId,
    owner_id: auth.user.id,
    role: 'assistant',
    content: 'Creating your image…',
    status: 'pending',
    request_id: idempotencyKey,
    metadata: { kind: 'generated_image' },
  }).select('id').single();
  if (assistantMessage.error) return jsonResponse(503, { code: 'generation_failed', message: 'The image request could not be prepared.' });

  const imageId = crypto.randomUUID();
  const storagePath = `${auth.user.id}/${imageId}.png`;
  const dimensions = size.split('x').map(Number);
  const imageRecord = await auth.serviceClient.from('jela_generated_images').insert({
    id: imageId, request_id: idempotencyKey, owner_id: auth.user.id, project_id: selectedProjectId,
    conversation_id: selectedConversationId, message_id: assistantMessage.data.id,
    prompt, model: 'gpt-image-2', storage_path: storagePath,
    width: dimensions[0], height: dimensions[1], status: 'processing',
  });
  if (imageRecord.error) return jsonResponse(503, { code: 'generation_failed', message: 'The image request could not be prepared.' });

  const openAIKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIKey) {
    await auth.serviceClient.from('jela_generated_images').update({ status: 'failed' }).eq('id', imageId);
    await auth.serviceClient.from('jela_messages').update({ content: 'Image creation is temporarily unavailable.', status: 'failed', error_code: 'image_generation_unavailable' })
      .eq('id', assistantMessage.data.id);
    return jsonResponse(503, { code: 'image_generation_unavailable', message: 'Image creation is temporarily unavailable.' });
  }
  try {
    meterId = await reserveMeter(
      auth.serviceClient, auth.user.id, 'image_generation', 1,
      entitlementLimit(entitlements, 'image_generation_limit'), false, entitlements.meter_period,
      entitlements.plan_code === 'free',
    );
  } catch {
    await auth.serviceClient.from('jela_generated_images').update({ status: 'failed' }).eq('id', imageId);
    await auth.serviceClient.from('jela_messages').update({ content: 'Image creation limit reached.', status: 'failed', error_code: 'image_limit_reached' })
      .eq('id', assistantMessage.data.id);
    return jsonResponse(429, { code: 'image_rate_limit', message: 'Image creation limit reached. You can continue chatting with Jela.' });
  }
  try {
    const upstream = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAIKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-image-2', prompt, size, quality, n: 1,
      }),
    });
    const result = await upstream.json() as { data?: Array<{ b64_json?: string; revised_prompt?: string }>; error?: { code?: string } };
    const generated = result.data?.[0];
    if (!upstream.ok || !generated?.b64_json) throw new Error(result.error?.code ?? `provider_${upstream.status}`);
    const uploaded = await auth.serviceClient.storage.from('jela-generated-images').upload(
      storagePath, decodeBase64(generated.b64_json), { contentType: 'image/png', upsert: false },
    );
    if (uploaded.error) throw new Error('storage_upload_failed');
    await auth.serviceClient.from('jela_generated_images').update({
      status: 'ready', revised_prompt: generated.revised_prompt ?? null,
    }).eq('id', imageId);
    await auth.serviceClient.from('jela_messages').update({
      content: 'Image created', status: 'complete',
      metadata: { kind: 'generated_image', generated_image_id: imageId },
    }).eq('id', assistantMessage.data.id);
    await auth.serviceClient.from('jela_conversations').update({ updated_at: new Date().toISOString() }).eq('id', selectedConversationId);
    const signed = await auth.serviceClient.storage.from('jela-generated-images').createSignedUrl(storagePath, 3600);
    await settleMeter(auth.serviceClient, meterId, 1, 1);
    return jsonResponse(200, {
      image: {
        id: imageId, conversationId: selectedConversationId, messageId: assistantMessage.data.id,
        prompt, revisedPrompt: generated.revised_prompt ?? null, width: dimensions[0], height: dimensions[1],
        createdAt: new Date().toISOString(), signedUrl: signed.data?.signedUrl ?? null,
      },
      replay: false,
    });
  } catch (error) {
    if (meterId) await settleMeter(auth.serviceClient, meterId, 1, 0).catch(() => undefined);
    await auth.serviceClient.from('jela_generated_images').update({ status: 'failed' }).eq('id', imageId);
    await auth.serviceClient.from('jela_messages').update({
      content: 'Image creation did not complete.', status: 'failed', error_code: 'image_generation_failed',
    }).eq('id', assistantMessage.data.id);
    await auth.serviceClient.from('jela_security_events').insert({
      actor_id: auth.user.id, subject_id: auth.user.id, event_type: 'image.generation_failed', severity: 'warning',
      metadata: { request_id: idempotencyKey, reason: error instanceof Error ? error.message : 'unknown' },
    });
    return jsonResponse(502, { code: 'image_generation_failed', message: 'Jela could not create that image. No result was saved.' });
  }
});
