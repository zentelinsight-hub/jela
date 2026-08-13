// @ts-nocheck -- Vitest executes this repository-contract test in Node; the mobile app compiler intentionally excludes Node globals.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../../');
const foundation = readFileSync(resolve(root, 'supabase/migrations/20260813110000_phase9_workspace_foundation.sql'), 'utf8');
const hardening = readFileSync(resolve(root, 'supabase/migrations/20260813130000_phase9_production_hardening.sql'), 'utf8');
const quotaHardening = readFileSync(resolve(root, 'supabase/migrations/20260813140000_phase9_quota_and_entitlement_fixes.sql'), 'utf8');
const settingsHardening = readFileSync(resolve(root, 'supabase/migrations/20260813150000_phase9_settings_and_override_safety.sql'), 'utf8');
const workspace = readFileSync(resolve(root, 'supabase/functions/jela-workspace/index.ts'), 'utf8');
const chat = readFileSync(resolve(root, 'supabase/functions/jela-chat/index.ts'), 'utf8');
const deletion = readFileSync(resolve(root, 'supabase/functions/jela-account-delete/index.ts'), 'utf8');
const oauth = readFileSync(resolve(root, 'mobile/src/services/oauth.ts'), 'utf8');
const googleLogin = readFileSync(resolve(root, 'mobile/src/app/(auth)/login.tsx'), 'utf8');
const googleSignup = readFileSync(resolve(root, 'mobile/src/app/(auth)/signup.tsx'), 'utf8');
const profileCompletion = readFileSync(resolve(root, 'mobile/src/app/(auth)/profile-completion.tsx'), 'utf8');
const accountService = readFileSync(resolve(root, 'mobile/src/services/account.ts'), 'utf8');
const genderProfile = readFileSync(resolve(root, 'supabase/migrations/20260813170000_replace_username_with_gender.sql'), 'utf8');

describe('Phase 9 production security contracts', () => {
  it('scopes both vector retrieval functions to the authenticated owner and ready embeddings', () => {
    expect(hardening).toMatch(/memory\.owner_id=p_user_id/);
    expect(hardening).toMatch(/chunk\.owner_id=p_user_id/);
    expect(hardening.match(/p_user_id=auth\.uid\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(hardening.match(/embedding_status='ready'/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('has private workspace storage policies tied to an owned file record', () => {
    expect(foundation).toContain("bucket_id='jela-workspace-files'");
    expect(foundation).toMatch(/file\.storage_path=name and file\.owner_id=auth\.uid\(\)/);
  });

  it('uses atomic advisory-lock primitives for projects, memory and file uploads', () => {
    expect(foundation).toContain("pg_advisory_xact_lock(hashtextextended('jela-project:'");
    expect(foundation).toContain("pg_advisory_xact_lock(hashtextextended('jela-memory:'");
    expect(hardening).toContain("pg_advisory_xact_lock(hashtextextended('jela-file:'");
    expect(chat).toContain("'web_search', 1");
    expect(quotaHardening).toContain("'jela-meter:'");
    expect(quotaHardening).toContain("interval '24 hours'");
  });

  it('keeps context bounded and project/file retrieval server-side', () => {
    expect(chat).toContain('.limit(budget.recentMessages)');
    expect(chat).toContain("bounded('recent_messages', 14, 30)");
    expect(chat).toContain('search_jela_memories');
    expect(chat).toContain('search_jela_document_chunks');
    expect(chat).toContain('Project instructions:');
  });

  it('queues embeddings and file extraction instead of holding the upload request open', () => {
    expect(workspace).toContain("'memory_embed'");
    expect(workspace).toContain("'file_extract'");
    expect(workspace).toContain('queued: true');
    expect(workspace).not.toContain("client.storage.from('jela-workspace-files').download(selected.data.storage_path)");
  });

  it('cleans every private Phase 9 storage namespace during account deletion', () => {
    expect(deletion).toContain("'jela-workspace-files'");
    expect(deletion).toContain("'jela-generated-images'");
    expect(deletion).toContain("'jela-attachments'");
    expect(deletion).toContain("'jela-avatars'");
  });

  it('keeps consent and user entitlement changes atomic and audited', () => {
    expect(settingsHardening).toContain("'jela-settings:'");
    expect(settingsHardening).toContain('account.ai_override_updated');
    expect(chat).toContain('storedMemory.enabled === true');
    expect(chat).toContain('memorySettings.enabled === true');
  });

  it('returns Google OAuth to the native app without an email OTP detour', () => {
    expect(oauth).toContain("Linking.createURL('callback')");
    expect(oauth).not.toContain('jelaai.com.ng');
    expect(googleLogin).toContain("router.replace('/' as Href)");
    expect(googleSignup).toContain("router.replace('/' as Href)");
    expect(googleLogin).not.toContain('login-verification');
    expect(googleSignup).not.toContain('login-verification');
  });

  it('persists required gender through the authenticated shared profile transaction', () => {
    expect(genderProfile).toContain('add column if not exists gender text');
    expect(genderProfile).toContain('update_jela_profile_v3');
    expect(genderProfile).toContain('and gender is not null');
    expect(accountService).toContain("rpc('update_jela_profile_v3'");
    expect(accountService).toContain('p_gender: input.gender');
    expect(profileCompletion).toContain('Select your gender.');
    expect(profileCompletion).not.toContain('label="Username"');
  });
});
