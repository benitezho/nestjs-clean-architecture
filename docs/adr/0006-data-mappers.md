# ADR 0006: Explicit data mappers at every boundary

Status: accepted

## Context

Three representations of an order exist: the domain aggregate, the TypeORM rows
and the HTTP DTOs. Converting between them ad hoc (a cast here, a spread there)
leaks one model into another: a request DTO reaching a use case, a database
string cast to an enum without checking it, a relation that may or may not be
loaded.

## Decision

Every boundary has one mapper class. Mappers are injectable and registered in the
feature module; nothing calls them statically.

- `shared/kernel/mapping` holds two minimal contracts: `DataMapper` (`toDomain`
  and `toPersistence`) and the one-way `Mapper` (`map`).
- `OrderPersistenceMapper` implements `DataMapper<Order, OrderRecord>`, where an
  `OrderRecord` is the order row plus its item rows. The repository loads both and
  hands the record over; it never converts anything itself.
- `OutboxMessageMapper` implements `Mapper<DomainEvent, OutboxMessage>`.
- `OrderHttpMapper` (in `interface/http`) builds responses from domain objects and
  turns the validated `PlaceOrderRequest` into a plain `PlaceOrderCommand`, so DTOs
  and their decorators never reach the application layer.

Persisted data is validated, not trusted. The status column is checked with a type
guard, and a stored row that violates a domain rule is reported as a
`PersistenceMappingError`. That error is deliberately not a `BaseError`: corrupt
data is a server fault and surfaces as a 500, not as a 422 blamed on the client
(see [ADR 0007](0007-error-model-and-http-mapping.md)).

## Consequences

- Each conversion has one home and one unit test, including null to undefined
  (`cancelled_at`) and back, and a domain to record to domain round trip.
- Adding a field means touching the mapper, which is the point: the compiler and
  the round-trip test show what was forgotten.
- More small classes and some repetition between DTO, command and response shapes.
  That duplication is real coupling insurance: an API change and a domain change
  now evolve independently.
- A `DataMapper` with a single `toPersistence` result suits an aggregate that is
  saved as a whole. Partial updates (the repository's `UPDATE ... WHERE version`)
  read only the fields they need from the mapped record.

## Trade-offs considered

- Decorator-based mappers (`class-transformer`, AutoMapper style) hide the mapping
  behind metadata and need framework imports; plain methods are easier to read and
  to test.
- A separate mapper per entity (order and order item) was rejected: items only
  exist inside the order aggregate and need the order's currency and id to map.
