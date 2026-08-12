import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getSupabase } from '@/lib/supabase';
import { UserMessageError } from '@/lib/errors';

void WebBrowser.maybeCompleteAuthSession();

export const nativeOAuthRedirect = Linking.createURL('auth/callback');

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
  const exchanged = await getSupabase().auth.exchangeCodeForSession(code);
  if (exchanged.error || !exchanged.data.session) throw new UserMessageError('Unable to complete Google sign-in. Please try again.');
  return exchanged.data.session;
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
