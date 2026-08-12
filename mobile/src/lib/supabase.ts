import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { appConfig } from '@/lib/config';
import { secureStorage } from '@/lib/secure-storage';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!appConfig) {
    throw new Error('Jela AI is not connected to its backend yet.');
  }

  if (!client) {
    client = createClient(appConfig.supabaseUrl, appConfig.supabasePublishableKey, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
      global: {
        headers: { 'X-Client-Info': 'jela-ai-android/1.2.0' },
      },
    });
  }

  return client;
}
