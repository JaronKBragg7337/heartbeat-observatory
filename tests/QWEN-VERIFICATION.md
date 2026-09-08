# Qwen console fix — 2026-09-07

Live page: https://www.heartbeatobservatory.com/qwen/

The public dashboard remains open; only the configured owner can message the
existing MSI session. This change does not alter the model, objective, local
bridge, execution permissions, Polymarket credentials, or account state.

## Regression checks

Run `node --test tests/qwen-console.test.mjs` for isolated UI behavior tests.
These fixtures do not authenticate to Supabase or invoke Qwen. They cover owner,
guest and observer UI, hidden sections, account switching, saved replies, failed
refresh/send handling, and loading the latest conversation without resetting
the reader's scroll position.

Run `tests/qwen-access.sql` with an administrative database connection for
rolled-back owner/visitor/guest permission checks. Expected: owner can read the
conversation, visitors cannot, non-owner enqueue returns `owner_access_required`,
and guests cannot execute enqueue. No client can directly mutate messages or
read the instance's private configuration columns.

Live database checks confirmed the existing owner message and Qwen response
are persisted and readable under the owner's authenticated role. Guest and
non-owner deny checks passed. The same agent/session continues reporting a
fresh heartbeat. No test message was delivered to Qwen during this fix.

The security advisor still flags the existing deliberately callable, token-gated
MSI RPCs and authenticated owner enqueue. Their authorization checks remain in
place; this migration adds no privileged RPC. See the
[Supabase RPC advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

Browser layout checks use a 393 × 852 viewport. Owner rendering is also checked
with the isolated fixtures; this does not claim access to the owner's phone or
browser session.

## Website appearance

The earlier Qwen deployment included pre-existing commit `3a0e7ef` (homepage and
Observatory presentation changes) from `codex/professional-observatory`. The
preceding production homepage said “Walk into the Observatory.” The Qwen commit
`ff21532` itself added a directory entry and page-specific Qwen CSS; publishing
that branch also published its earlier redesign. This fix does not modify the
homepage or shared styles and does not reverse the earlier redesign.
