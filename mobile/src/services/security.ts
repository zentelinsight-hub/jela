import { getSupabase } from '@/lib/supabase';
import type { AppRole, JelaAccount } from '@/types/database';

export type LoginStatus = {
  verified: boolean;
  verifiedAt?: string | null;
  verificationExpiresAt?: string | null;
  authMethods?: string[];
  email?: string | null;
  emailConfirmed?: boolean;
  account?: JelaAccount | null;
  roles?: AppRole[];
  profileComplete?: boolean;
  adminAccessGranted?: boolean;
};

type Challenge = {
  challengeId: string;
  maskedEmail: string;
  expiresAt: string;
  resendIn: number;
  maxAttempts: number;
};

function responseMessage(data: unknown, fallback: string) {
  if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') return data.message;
  return fallback;
}

async function invoke<T>(name: string, body: Record<string, unknown> = {}, headers?: Record<string, string>) {
  const result = await getSupabase().functions.invoke<T>(name, { body, headers });
  if (result.error) throw new Error(responseMessage(result.data, result.error.message));
  if (!result.data) throw new Error('The secure request returned no data.');
  return result.data;
}

export function fetchLoginStatus() {
  return invoke<LoginStatus>('jela-login-status');
}

export function startEmailChallenge(purpose: 'login' | 'sensitive_action' = 'login') {
  return invoke<Challenge>('jela-login-start', { purpose });
}

export async function verifyEmailChallenge(challengeId: string, code: string) {
  const result = await invoke<{
    accessToken: string;
    refreshToken: string;
    profileComplete: boolean;
    isAdmin: boolean;
  }>('jela-login-verify', { challengeId, code });
  const session = await getSupabase().auth.setSession({
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
  });
  if (session.error || !session.data.session) throw session.error ?? new Error('The verified session could not be saved.');
  return result;
}

export function grantAdminAccess(code: string) {
  return invoke<{ granted: boolean; expiresAt: string }>('jela-admin-access', { mode: 'verify', code });
}

export function rotateAdminAccessCode(newCode: string) {
  return invoke<{ rotated: boolean }>('jela-admin-access', { mode: 'rotate', newCode });
}

export function setGoogleAccountPassword(password: string) {
  return invoke<{ passwordSet: boolean }>('jela-google-password', { password });
}

export function cancelSubscription() {
  return invoke<{ cancelled: boolean; currentPeriodEnd: string | null }>('jela-subscription-cancel');
}

export function deleteAccount(confirmation: string, targetUserId?: string) {
  return invoke<{ deleted: boolean }>('jela-account-delete', { confirmation, targetUserId });
}

export function generateImage(input: {
  prompt: string;
  conversationId?: string | null;
  projectId?: string | null;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  quality?: 'low' | 'medium' | 'high';
  requestId: string;
}) {
  return invoke<{ image: GeneratedImage; replay: boolean }>('jela-image-generate', {
    prompt: input.prompt,
    conversationId: input.conversationId ?? null,
    projectId: input.projectId ?? null,
    size: input.size ?? '1024x1024',
    quality: input.quality ?? 'medium',
  }, { 'X-Idempotency-Key': input.requestId });
}

export type GeneratedImage = {
  id: string;
  conversationId: string;
  messageId: string;
  prompt: string;
  revisedPrompt?: string | null;
  width: number;
  height: number;
  createdAt: string;
  signedUrl: string | null;
  projectId?: string | null;
};

export async function listGeneratedImages(limit = 40, offset = 0, projectId?: string | null) {
  const supabase = getSupabase();
  let request = supabase.from('jela_generated_images')
    .select('id,conversation_id,project_id,message_id,prompt,revised_prompt,storage_path,width,height,created_at')
    .eq('status', 'ready').order('created_at', { ascending: false }).range(offset, offset + limit);
  if (projectId) request = request.eq('project_id', projectId);
  const result = await request;
  if (result.error) throw result.error;
  const rows = result.data ?? [];
  const images = await Promise.all(rows.slice(0, limit).map(async (row) => {
    const signed = await supabase.storage.from('jela-generated-images').createSignedUrl(row.storage_path, 3600);
    return {
      id: row.id,
      conversationId: row.conversation_id,
      messageId: row.message_id,
      prompt: row.prompt,
      revisedPrompt: row.revised_prompt,
      width: row.width,
      height: row.height,
      createdAt: row.created_at,
      signedUrl: signed.data?.signedUrl ?? null,
      projectId: row.project_id,
    } as GeneratedImage;
  }));
  return { images, hasMore: rows.length > limit };
}
