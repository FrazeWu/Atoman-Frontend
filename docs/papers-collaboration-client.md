# Papers durable collaboration client (stage 8.3B2)

The existing LaTeX CodeMirror editor now accepts an authoritative Y.Text
and binds it with the already installed y-codemirror.next extension.
Ordinary editor history and modelValue replacement are disabled for this
mode, including the old whole-text save event. The shared blog provider
is not used because it speaks a different, peer-relay protocol.

A session can be started only from a clean text file, with no in-flight
ordinary save or structural/compile operation. The user explicitly opens
the collaboration panel; the capability response must match protocol
papers-crdt-v1 and the current project role. Disabled or unknown
capabilities never create a WebSocket. Cookie or existing API-token
subprotocol authentication is reused; credentials are not put in URLs.

The client creates an empty Y.Doc and waits for the server's valid
committed checkpoint. It does not seed from modelValue. Full checkpoints
are applied as CRDT updates, not whole-text replacements. Local updates
are batched for 200 ms, with one in-flight delta and a bounded pending
batch. Request UUIDs match durable acknowledgements; only acknowledged
updates become saved. A retryable error retries the exact same bytes and
UUID up to three times, with bounded exponential delay. Unexpected
epochs, roles, stale state, invalid frames and acknowledgement timeout
freeze the local editor rather than overwriting the server. Source and
binary update limits match the backend. A read-only member sends no
document updates. A viewer cannot seed a new room.

Ordinary saves, file navigation and mutations, compilation, project
export and snapshot operations are disabled during collaboration.
Leaving the project requires explicitly exiting collaboration first.
An unconfirmed local document is held in memory and can be copied;
exit requires confirmation if any local updates remain unacknowledged.
Exiting reloads the canonical project from the server. A change of
authenticated account tears down the old session and clears project data.
The ordinary local-draft store is not used for CRDT pending updates.

Limitations: production is not enabled by this task. Automatic reconnect,
durable offline recovery across browser restart, server-to-client
state-vector deltas, awareness/presence, remote cursors, collaborative
undo and compile/checkpoint coordination are not implemented yet.
The current feature uses whole compact server checkpoints and a bounded
prototype connection policy. Do not interpret the browser fixture test
as a production load test or actual backend connection: the browser test
uses two authenticated contexts and a local Yjs-backed protocol fixture;
the backend separately tests real WebSockets, isolated Worker and
PostgreSQL persistence.

Regression tests:
- tests/unit/components/papers/durableCollaboration.spec.ts
- tests/unit/components/papers/LatexEditor.spec.ts
- tests/e2e/specs/papers-collaboration.spec.ts
