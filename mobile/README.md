# Jela AI native Android app

`mobile/` is the isolated Expo/React Native application for Jela AI. It is a real native app with Expo Router route groups, not a WebView, PWA wrapper, or copy of the public website.

## Architecture

- Expo SDK 57, React Native 0.86.2, React 19.2.3, and TypeScript.
- Expo Router groups: `(auth)`, `(user)`, and separately guarded `(admin)`.
- Supabase Auth sessions persisted with `expo-secure-store`; only the non-sensitive theme preference uses AsyncStorage.
- Server-authoritative account status, roles, conversations, credits, plans, subscriptions, billing, releases, and feature flags.
- Authenticated Supabase Edge Function for OpenAI Responses API streaming. Provider keys remain hosted secrets.
- FlashList-backed native chat history, a fixed native header and keyboard-aware composer, light/dark/system appearance, and private attachment infrastructure.

Important paths:

```text
mobile/src/app/           Native routes
mobile/src/components/    Shared native UI and Chat
mobile/src/contexts/      Auth, feature, and theme state
mobile/src/services/      Supabase and Edge Function clients
mobile/src/lib/           Validation, update, routing, and request contracts
mobile/assets/brand/      Official unmodified brand files
supabase/migrations/      Authoritative schema, RLS, credits, and releases
supabase/functions/       Server-only AI provider boundary
```

## Local development

Requirements are Node.js 20+, npm, an Android emulator or device for native testing, and an Expo account only when using EAS Build.

```bash
cd mobile
npm install
copy .env.example .env
npm run start
```

Set only the public mobile variables in `.env`:

```text
EXPO_PUBLIC_SUPABASE_URL=https://mjihdpcqohvrbcpqmuvo.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_JELA_WEBSITE_URL=https://jela-ai-official.victorudofiah25.chatgpt.site
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_ENABLE_GOOGLE_AUTH=false
EXPO_PUBLIC_ENABLE_GITHUB_AUTH=false
```

Anything prefixed `EXPO_PUBLIC_` can be extracted from an APK. Never put a service-role key, OpenAI key, payment secret, OAuth client secret, signing key, or arbitrary server secret there. The app displays a safe setup state when its public Supabase variables are missing.

Useful commands:

```bash
npm run android
npm run typecheck
npm run lint
npm run test
npx expo-doctor
```

Email/password authentication is implemented. Google and GitHub controls are hidden by default and must remain hidden until their Supabase provider, OAuth redirect, and matching public flag are all configured and tested. Deep links use the `jela` scheme (`jela://callback`, `jela://verify`, and `jela://reset-password`).

## Android identity and EAS

- Application ID: `com.zentelinsight.jela`
- Deep-link scheme: `jela`
- Initial version: `1.0.0`
- Initial Android version code: `1`
- Build profiles: `development`, `preview`, and `production-apk`

The production APK command is:

```bash
npx eas-cli@latest build --platform android --profile production-apk
```

`production-apk` explicitly requests an installable APK. EAS credentials must be configured under the authorized Expo owner. Preserve the same Android application ID and production signing key forever; otherwise Android will not install later versions as updates. Never commit or print the keystore, aliases, or passwords. Increment both `expo.version` and `android.versionCode` for every public native release.

The app is linked to the Zentel Insight EAS project and `expo-updates` uses the EAS project URL, an app-version runtime policy, and separate development/preview/production channels. Use OTA only for compatible JavaScript/assets changes. Native dependency, permission, SDK, or platform changes always require a new signed APK and a higher native version.

## Backend rollout

The project uses the existing Supabase project `mjihdpcqohvrbcpqmuvo`. The migrations create Jela-specific tables, RLS policies, transactional credit reservation/settlement RPCs, private attachment storage, and exact application states: Active, Restricted, Suspended, and Deactivated. These states never delete or globally block a person’s Supabase Auth identity.

Chat is deliberately disabled by default. To enable it safely, an administrator must:

1. confirm the hosted `OPENAI_API_KEY` secret;
2. publish exactly one enabled `jela_model_config` row with measured model and credit policy;
3. grant real credits through a trusted administrative operation;
4. validate streaming, metering, failure settlement, rate limits, and content policy in a staging account;
5. set `jela_app_config.chat_enabled` to `true` only after those checks pass.

No model price, plan, credit grant, subscription, checkout, or AI answer is hardcoded in the APK. Attachments, voice, and push notifications also remain hidden or unavailable until their backend rollout is explicitly enabled and tested.

## Production APK release procedure

1. Increment version name and version code; confirm backend metadata will match.
2. Build with `production-apk` using the established EAS signing identity.
3. Download the APK and calculate SHA-256 (`Get-FileHash -Algorithm SHA256` on Windows).
4. Install it on a clean Android device/emulator with `adb install`; for later releases verify in-place upgrade with `adb install -r`.
5. Smoke-test cold launch, auth, password recovery deep link, Chat states, history, credits, plans, settings, theme, rotation, restricted/suspended routing, update check, and offline/error behavior.
6. Upload the verified file to the existing private bucket path `jela-ai-releases/android/jela-ai-vX.Y.Z.apk`.
7. Create its `jela_ai_releases` metadata with version code, size, SHA-256, notes, and minimum-supported version, but leave `is_current=false` while verifying the signed download.
8. In one trusted transaction unset the previous Android current row and mark the verified row current.
9. Recheck the public website `/download` page. Retain previous APK rows and objects for rollback.

Never mark an APK current merely because EAS produced it. An EAS internal URL is not the public distribution channel; the verified release belongs in the existing Supabase release system and is surfaced by the official website.

## Android developer-verification preparation

Keep a stable package ID, release certificate, website domain, privacy policy, Terms, version history, checksum trail, and signed release archive. Record the SHA-256 certificate fingerprint securely for future Android developer verification or store distribution. The app requests no dangerous install permissions and opens the official website for updates rather than silently downloading or installing APKs.
