# ADR 0003: UnitOfWork with the transaction propagated through AsyncLocalStorage

Status: accepted

## Context

A use case sometimes needs several repositories, plus the outbox writer and the
idempotency table, to commit atomically. The common options are to pass an
`EntityManager` through every method signature (which leaks the ORM into the
application layer) or to give each repository its own transaction (which is not
atomic).

## Decision

`TransactionManager` (`shared/database`) stores the active `EntityManager` in an
`AsyncLocalStorage`.

- `run(work)` opens a transaction, makes it the current one for everything
  awaited inside `work`, and commits or rolls back. Nested calls join the outer
  transaction instead of opening another.
- Repositories and writers read `transactions.manager`, which is the active
  transactional manager inside `run` and the default manager otherwise. They need
  no extra parameter.
- The application layer only sees the `UnitOfWork` port. `TypeormUnitOfWork` is a
  thin adapter over `TransactionManager`.
- `save` wraps itself in `run`, so saving an aggregate and its events is atomic
  even when the caller has not opened a unit of work, and joins one when it has.
  `OutboxWriter` calls `requireManager()` and throws outside a transaction.

## Consequences

- Use case code stays free of ORM types, and composing work (idempotency key +
  order + outbox) is a matter of nesting `run` calls.
- It is implicit. A repository call inside a callback that escapes the async
  context (a detached `setTimeout`, an event emitter listener) does not see the
  transaction and silently uses the default connection. Keep transactional work
  awaited.
- The transaction uses the database default isolation (READ COMMITTED).
  Correctness under concurrency relies on the version column and unique
  constraints, not on isolation level.
- A transaction holds a pooled connection for its whole duration, so do not make
  slow network calls inside `run`.
