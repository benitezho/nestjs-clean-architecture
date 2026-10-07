# ADR 0001: Feature modules with clean layers and an enforced dependency rule

Status: accepted

## Context

Layered architectures decay when the dependency direction is only a convention.
In a NestJS codebase the usual failure is a use case that imports a TypeORM
entity or a decorator "just this once", after which the domain can no longer be
tested without the framework.

## Decision

Each feature lives in `src/modules/<feature>/` and is split into four layers:

- `domain/`: aggregates, value objects, domain events and errors. Pure
  TypeScript. It may import only other files of its own `domain/` and Node core
  modules.
- `application/`: use cases and the ports they need (`OrderRepository`,
  `UnitOfWork`, `Clock`, `IdGenerator`). It may import only its own `domain/`
  and `application/`.
- `infrastructure/`: adapters that implement the ports (TypeORM entities,
  mappers, repositories, system clock).
- `interface/http/`: controllers, DTOs and presenters. It may use the
  application layer but never `infrastructure/`.

Ports are abstract classes. They are valid DI tokens, so no `Symbol` tokens and
no `@Inject()` decorators are needed in the application layer. Use cases are
plain classes; the Nest module wires them to adapters with `useFactory`.

`shared/` is infrastructure that several features reuse. It never imports from
`modules/`.

The rule is enforced by `pnpm check:architecture` (dependency-cruiser,
`.dependency-cruiser.cjs`) and runs in CI. The rules also fail on import cycles,
except between TypeORM entities that reference each other.

## Consequences

- The domain and application suites run in milliseconds with no database and no
  Nest container.
- A violation is a failing build, not a review comment.
- Some mapping code is unavoidable: entities and domain objects are separate
  types and `OrderMapper` is the single place that converts between them. This is
  the price of keeping the persistence model out of the domain.
- Cross-cutting infrastructure that needs to be generic (transactions, outbox,
  idempotency) lives in `shared/` and cannot depend on a feature. Where a
  feature port needs a shared implementation, the feature provides a thin adapter
  (see `TypeormUnitOfWork` and ADR 0003).
