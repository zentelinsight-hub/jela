import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getSupabase } from '@/lib/supabase';
import { UserMessageError } from '@/lib/errors';
import type { Session } from '@supabase/supabase-js';

void WebBrowser.maybeCompleteAuthSession();

// Expo Router route groups such as `(auth)` are not part of the external URL.
// Keep Google OAuth on the app-owned `jela://callback` deep link so Supabase
// never falls back to the marketing website after provider consent.
export const nativeOAuthRedirect = Linking.createURL('callback');

let pendingCode: string | null = null;
let pendingExchange: Promise<Session> | null = null;

function providerError(url: string) {
  const params = Linking.parse(url).queryParams ?? {};
  return params.error_description ?? params.error;
}

export async function completeGoogleCallback(url: string) {
  const callbackParams = Linking.parse(url).queryParams ?? {};
  const rawError = callbackParams.error_description ?? callbackParams.error;
  if (rawError) throw new UserMessageError('Unable to sign in with Google. Please try again.');
  const rawCode = callbackParams.code;
  const code = Array.isArray(rawCode) ? rawCode[0] : typeof rawCode === 'string' ? rawCode : null;
  if (!code) throw new UserMessageError('Unable to complete Google sign-in. Please try again.');
  if (pendingCode === code && pendingExchange) return pendingExchange;
  pendingCode = code;
  pendingExchange = (async () => {
    const current = await getSupabase().auth.getSession();
    if (current.data.session) return current.data.session;
    const exchanged = await getSupabase().auth.exchangeCodeForSession(code);
    if (exchanged.error || !exchanged.data.session) throw new UserMessageError('Unable to complete Google sign-in. Please try again.');
    return exchanged.data.session;
  })();
  try { return await pendingExchange; }
  finally { pendingCode = null; pendingExchange = null; }
}

export async function continueWithGoogle() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: nativeOAuthRedirect, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new UserMessageError('Unable to sign in with Google. Please try again.');
  const result = await WebBrowser.openAuthSessionAsync(data.url, nativeOAuthRedirect);
  if (result.type === 'cancel' || result.type === 'dismiss') throw new UserMessageError('Google sign-in was cancelled.');
  if (result.type !== 'success' || !result.url) throw new UserMessageError('Unable to sign in with Google. Please try again.');
  if (providerError(result.url)) throw new UserMessageError('Unable to sign in with Google. Please try again.');
  return completeGoogleCallback(result.url);
}
