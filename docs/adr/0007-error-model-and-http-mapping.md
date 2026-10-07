# ADR 0007: One error model, one global filter, RFC 9457 responses

Status: accepted

## Context

Domain, application and idempotency errors each declared their own `kind` and
`code`, and the HTTP layer recognised them by duck typing any object that had those
two properties. A look-alike error was silently treated as a client error, a
forgotten error class turned into an opaque 500, and database failures (a unique
violation, a deadlock) were not mapped at all.

## Decision

`shared/kernel/errors` defines a single `BaseError` with `kind`, a stable `code`
and optional `details`. `DomainError` (business rule violated) and
`ApplicationError` (use case could not complete) extend it. The kernel is pure
TypeScript and both the domain and application layers may import it.

`GlobalExceptionFilter` (`shared/http`) is the only place that turns errors into
HTTP, as `application/problem+json`. The mapping itself is a pure function in
`exception-mapping.ts`.

| Source                                              | Status  | Code                                        |
| --------------------------------------------------- | ------- | ------------------------------------------- |
| `BaseError`, kind `bad_request`                     | 400     | the error's `code`                          |
| `BaseError`, kind `validation`                      | 422     | the error's `code`                          |
| `BaseError`, kind `not_found`                       | 404     | the error's `code`                          |
| `BaseError`, kind `conflict`                        | 409     | the error's `code`                          |
| `HttpException` (ValidationPipe, unknown route)     | its own | none, `errors` lists invalid fields         |
| PostgreSQL `23505` unique_violation                 | 409     | `persistence.unique_violation`              |
| PostgreSQL `40001` serialization / `40P01` deadlock | 503     | `persistence.retryable`, with `Retry-After` |
| Anything else                                       | 500     | none, generic detail                        |

The kind to status table is an exhaustive `Record<ErrorKind, HttpStatus>`, so a
new kind does not compile until it has a status. `details` is returned as an
extension member (for example `expected` and `actual` currencies).

Server errors (5xx) are logged in full, with method, URL and request id, and are
never described to the client: no message, stack, SQL or constraint name. Client
errors are logged at debug level without a stack.

## Consequences

- Throwing a domain or application error is enough to get the right status; a new
  error needs no HTTP code. Errors that do not extend `BaseError` are always 500.
- Clients can retry a 503 safely and tell a duplicate (409) from a bad request.
- Business rule violations are 422 and state conflicts are 409 (see ADR 0005);
  400 is reserved for malformed requests.
- Domain errors carry only data that is safe to expose, since `details` goes to the
  client as is.
- Only a short list of SQLSTATEs is mapped. Anything else is a 500 on purpose; add
  a state to the table when a client has a reason to react to it.

## Trade-offs considered

- NestJS `HttpException` subclasses in the domain would remove the filter but tie
  the domain to the framework.
- One filter per error family (`@Catch(DomainError)` and so on) is more Nest-idiomatic
  but spreads the status policy over several classes; a single table is easier to
  audit.
- `Retry-After` is a fixed 1 second: simple and enough for transient contention.
  A real deployment may want jitter or a value from configuration.
