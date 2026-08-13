# Jela AI Windows client foundation

The future Windows product is an authenticated Jela workspace client, not a wrapper around the marketing website.

## Proposed shell

- Tauri 2 hosts a React workspace UI.
- Supabase Auth, Postgres, Storage, Realtime, and Edge Functions remain authoritative.
- `jela-execute`, workspace repositories, entitlement RPCs, and notification metadata are shared contracts with Android.
- The desktop client stores only encrypted session material and bounded non-secret cache data locally.

## Native capability boundaries

- Tauri commands own file picking, drag/drop, filesystem export, deep links, tray integration, desktop notifications, and updater integration.
- No OpenAI, Paystack, Supabase service-role, embedding, or Admin secret may enter the binary.
- Workspace uploads use server-issued signed upload tokens. AI execution always passes through `jela-execute`.
- Local queues may retry idempotent metadata reads and signed uploads. AI sends require an idempotency key and must not be silently replayed offline.

## Information architecture

Chat remains the primary surface. Desktop navigation may use a responsive sidebar for New Chat, Search, Create, Projects, Recent, Files, Memory, Images, Usage, and Settings. Project context scopes chats, files, images, memory, and instructions exactly as it does on Android.

## Delivery sequence

1. Extract TypeScript API contracts for identity, workspace, entitlements, usage, and releases.
2. Build the authenticated React workspace against staging Supabase.
3. Add Tauri file/deep-link/notification adapters behind interfaces.
4. Add Windows code signing and a signed updater manifest.
5. Run the same cross-user RLS, retrieval, quota, deletion, and upgrade tests as Android before publishing any Windows download.

PWA work is deferred. No Windows binary or public Windows download exists in Phase 9.
