# Phase 9 security and retrieval acceptance checks

These scenarios are mandatory against a staging or isolated linked Supabase environment before the Android release is published. Repository contract tests and production read-only checks are automated; content-level retrieval and concurrency scenarios must use isolated QA identities so production user content is never inspected.

## Ownership and RLS

- User A cannot select, update, or delete User B's project, memory, file metadata, device, conversation, or generated image.
- `search_jela_memories` called for User A never returns an owner other than A, including under a forged project/conversation ID.
- `search_jela_document_chunks` called for User A never returns User B chunks or Project B chunks when Project A is selected.
- Signed workspace-file URLs cannot be created for an object without a matching owned, non-deleted file record.
- Admin overview/account metrics expose counts and operational state, never memory text, file text, raw vectors, push tokens, or provider secrets.

## Retrieval evals

- Global memory “My company is ABC Technologies” is selected for a relevant new business-marketing question.
- A React/Supabase fact saved in Project A is selected in Project A and excluded from Project B.
- A deleted memory and a memory with `embedding_status != ready` are never retrieved.
- Memory disabled stops both retrieval and automatic extraction; disabling automatic save alone preserves permitted retrieval.
- A text-based PDF becomes Ready, a targeted question selects relevant chunks, and unrelated pages remain outside the context budget.
- Research citations persist in assistant-message metadata and render after reopening the conversation.

## Atomic quota and lifecycle checks

- Two clients simultaneously attempt the last Project, workspace upload, Research, and image allowance; at most one reservation succeeds.
- Paid meter windows match the confirmed subscription/trial period. Expired or failed renewal resolves to the current Free policy and does not grant a new paid window.
- Failed provider requests settle Research/image reservations back to zero.
- File deletion removes Storage, chunks, vectors, and storage-meter use. Conversation deletion removes chat attachments/images. Account deletion removes every private Storage prefix before Auth deletion.
- Background jobs retry with backoff, become failed after the maximum attempts, and expose only privacy-safe status in Admin.
- Free Research and image meters open an atomic rolling 24-hour window on first reservation; they are not calendar-day counters.

## Cross-device and regression checks

- Project, memory settings, files, conversations, images, entitlements, subscription, and usage appear after signing into another device.
- Realtime updates active project/file/memory screens without restart; offline mode shows cached browsing and blocks live AI naturally without queueing duplicate sends.
- OTP remains six digits; Google profile/password completion remains mandatory; billing, keyboard, Android system Back, notifications, and the existing single-current APK update path remain functional.

## Data export readiness

Phase 9 keeps stable ownership keys and deletion-safe relationships across identity, conversations, projects, files, chunks, memories, images, usage, subscription, devices, and notifications. A future export worker can traverse these relationships by `owner_id`, stream private Storage objects through short-lived signed URLs, and produce an audited archive without exposing the service role to a client. Export execution is intentionally deferred so it does not weaken the completed deletion and privacy controls.
