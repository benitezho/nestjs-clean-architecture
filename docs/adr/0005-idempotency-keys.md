# ADR 0005: Idempotency-Key for POST /orders, stored in the same transaction

Status: accepted

## Context

Clients retry `POST /orders` after timeouts and cannot tell whether the first
attempt succeeded. Without protection a retry creates a second order.

## Decision

Support the `Idempotency-Key` request header on `POST /orders`. It is optional;
without it the request is not deduplicated.

- `idempotency_keys` has primary key `(scope, key)` and stores a SHA-256 of the
  canonical request body (key order does not matter), plus the response status and
  body.
- `IdempotencyService.execute` runs inside one transaction: it inserts the key
  with `ON CONFLICT DO NOTHING`, runs the handler (which places the order and
  writes the outbox row, joining the same transaction through ADR 0003), then
  stores the response. The key, the order and the outbox event commit together.
- Same key and same body: the stored response is replayed with the original
  status and an `Idempotent-Replayed: true` header.
- Same key and different body: `422 Unprocessable Content` with problem code
  `idempotency.key_reuse`. 422 was chosen over 409 because the request is
  well-formed but semantically invalid for this key; 409 is reserved for state
  conflicts such as cancelling twice.
- A malformed key (empty, over 255 characters, non-printable-ASCII) is a 400.
- Concurrent requests with the same key: the second insert blocks on the unique
  index until the first transaction ends, then replays its response. The handler
  runs exactly once.

## Consequences

- Only successful responses are stored. If the handler fails (validation, business
  rule, crash), everything rolls back, the key stays unused, and the client may
  retry with the same key.
- The request is in flight inside a database transaction, so a concurrent duplicate
  holds a connection while it waits.
- The scope is part of the key, so the same key may be reused for different
  endpoints. Keys are not tied to a caller; add the authenticated principal to the
  scope when the API has authentication.
- Rows are never purged. Delete rows older than your retry window with a scheduled
  job.
