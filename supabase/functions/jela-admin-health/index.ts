import { adminUser, corsHeaders, jsonResponse } from '../_shared/http.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { code: 'method_not_allowed', message: 'Use POST.' });
  const auth = await adminUser(request);
  if (auth instanceof Response) return auth;
  const [database, storage, jobs] = await Promise.all([
    auth.serviceClient.from('jela_app_config').select('key', { head: true, count: 'exact' }).limit(1),
    auth.serviceClient.storage.from('jela-workspace-files').list('', { limit: 1 }),
    auth.serviceClient.from('jela_workspace_jobs').select('status').in('status', ['queued', 'processing', 'failed']).limit(1000),
  ]);
  const failedJobs = (jobs.data ?? []).filter((job) => job.status === 'failed').length;
  return jsonResponse(200, {
    openai: Deno.env.get('OPENAI_API_KEY') ? 'configured' : 'unavailable',
    paystack: Deno.env.get('PAYSTACK_API_KEY') ? 'configured' : 'unavailable',
    database: database.error ? 'degraded' : 'healthy',
    storage: storage.error ? 'degraded' : 'healthy',
    auth: 'healthy',
    realtime: 'configured',
    email: 'managed',
    embedding_jobs: jobs.error ? 'degraded' : failedJobs > 0 ? 'degraded' : 'healthy',
  });
});
