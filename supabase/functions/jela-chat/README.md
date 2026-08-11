# Jela chat Edge Function

This authenticated function is the only AI provider boundary for the native app. It validates the Supabase user, account status, feature flags, conversation ownership, private attachment ownership, idempotency key, enabled model policy, and available credits before calling OpenAI's Responses API with server-sent streaming events.

Required hosted secret:

- `OPENAI_API_KEY` — set with the Supabase secret manager; never place it in the mobile app or repository.

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to the hosted runtime. Chat remains disabled by default until a non-secret model policy and credit grant are configured and `chat_enabled` is explicitly changed to `true`.
