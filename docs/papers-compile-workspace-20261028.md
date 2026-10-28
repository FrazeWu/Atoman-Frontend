# Atoman Papers: compile status UI preparation (2026-10-28)

Branch: feat/papers-compile-workspace-20261028, based on the existing
Papers integration frontend 5eabbe75.

The Papers editor now understands the private compile API contract, but
remains **fail-closed** when compile-capability is absent, disabled, or
cannot be fetched. On the current deployed backend it will therefore show
a disabled Compile button instead of exposing an unsafe execution path.

When a future reviewed backend explicitly reports enabled=true, the editor:
- Saves the current text before requesting a compile, refusing to proceed
  after a save failure/revision conflict.
- Refetches the project revision, sends that revision and a fresh idempotency
  key, then renders the bounded job status and cancellation state.
- Loads the last accepted job without blocking the source editor, and polls
  only while it is queued/running/recovering. A second compile cannot be
  started while a job remains active. Polls are cleaned up on route change
  or unmount; network refresh is avoided while the page is hidden.
- Shows a safe cancellation-pending state while the worker/sandbox completes
  cleanup rather than claiming that a running task was instantly stopped.
- Never uses a public PDF URL. Even after a succeeded job, PDF preview
  remains unavailable until the Worker and private authenticated result
  storage are proven and integrated.

No production deployment, frontend main merge, or hosted site change was
performed as part of this independent worktree.

Recommended verification:

    bun install --frozen-lockfile
    bun run type-check
    NODE_ENV=test bunx vitest run tests/unit/components/papers/PaperWorkspaceView.spec.ts --maxWorkers=1
    bun run build

The UI should only become enabled by a server-side capability explicitly
provided by a trusted production deployment. A developer flag, URL or local
state toggle must not turn on server-side TeX execution.
