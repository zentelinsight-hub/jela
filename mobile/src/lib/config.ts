import { z } from 'zod';

const environmentSchema = z.object({
  supabaseUrl: z.string().url(),
  supabasePublishableKey: z.string().min(20),
  websiteUrl: z.string().url(),
  appEnvironment: z.enum(['development', 'preview', 'production']),
  enableGoogleAuth: z.boolean(),
  enableGitHubAuth: z.boolean(),
});

const rawConfig = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  websiteUrl:
    process.env.EXPO_PUBLIC_JELA_WEBSITE_URL ??
    'https://jela-ai-official.victorudofiah25.chatgpt.site',
  appEnvironment: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  enableGoogleAuth: process.env.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH === 'true',
  enableGitHubAuth: process.env.EXPO_PUBLIC_ENABLE_GITHUB_AUTH === 'true',
};

const parsedConfig = environmentSchema.safeParse(rawConfig);

export const appConfig = parsedConfig.success ? parsedConfig.data : null;
export const configIssues = parsedConfig.success
  ? []
  : parsedConfig.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);

export const hasConfiguredBackend = appConfig !== null;
