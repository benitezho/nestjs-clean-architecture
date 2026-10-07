# ADR 0002: Transactional outbox with a SKIP LOCKED polling relay

Status: accepted

## Context

Placing or cancelling an order must change state and announce it to other
systems. Writing to the database and then publishing to a broker is a dual
write: a crash between the two loses the event or announces a change that was
rolled back.

## Decision

Use a transactional outbox.

- The aggregate records domain events. `OrderRepository.save` persists the
  aggregate and inserts the pulled events into `outbox_events` in the same
  transaction. `OutboxWriter` refuses to run outside a transaction.
- A polling relay (`OutboxRelay`, driven by `OutboxRelayWorker`) claims due rows
  in a transaction with `SELECT ... FOR UPDATE SKIP LOCKED`, publishes each one
  through the `EventPublisher` port, and marks it `published`. Concurrent relays
  therefore take disjoint batches and several instances can run safely.
- On failure the row stays `pending` with `attempts + 1` and
  `next_attempt_at = now + base * 2^(attempts-1)` (capped). After
  `OUTBOX_MAX_ATTEMPTS` it becomes `failed`, which is terminal and needs a human.
- The event UUID is the primary key and is passed to publishers as the message
  id/key.
- The worker starts on bootstrap, is configurable (`OUTBOX_RELAY_ENABLED`,
  `OUTBOX_POLL_INTERVAL_MS`, `OUTBOX_BATCH_SIZE`, ...), and on shutdown stops
  polling and waits for the in-flight batch.
- The default publisher only logs. Swapping it is a one-line provider change.

## Consequences

- Delivery is at-least-once. A crash after publishing but before commit
  re-delivers the batch, so consumers must deduplicate on the event id.
- Ordering is best effort (`occurred_at, id` within a batch). Retries and several
  relays can reorder events, including events of the same aggregate. If a
  consumer needs per-aggregate ordering, it must use the aggregate id as the
  partition key and tolerate or reorder by `occurredAt`.
- Publishing happens inside the claiming transaction, which is what makes
  `SKIP LOCKED` sufficient and keeps the code small. The cost is that a slow
  broker holds a connection and row locks for the duration of the batch. Keep
  batches small and publisher timeouts short. The alternative (claim, commit,
  publish, then update) needs lease columns and a reaper for abandoned claims.
- Polling adds latency up to the poll interval and a constant light query load.
  The partial index on `next_attempt_at WHERE status = 'pending'` keeps the scan
  cheap. Log-based CDC (for example Debezium) removes both at the cost of
  operating it.
- Published rows are not deleted. Add a retention job for your volume.
