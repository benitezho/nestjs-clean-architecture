# ADR 0004: Money as integer minor units plus an ISO 4217 currency

Status: accepted

## Context

Floating point cannot represent most decimal prices exactly, and `0.1 + 0.2`
style errors turn into reconciliation bugs. Decimal libraries and `numeric`
columns are correct but spread a type through every layer.

## Decision

`Money` is an immutable value object: a non-negative safe integer `amount` in the
currency's minor unit (cents for USD) and a three-letter uppercase currency code.

- Operations are `add`, `multiply` by a non-negative integer, `equals`. Adding
  different currencies throws `CurrencyMismatchError`. Any result outside the
  safe integer range throws, so overflow cannot be silent.
- An order's total is computed from its items and never accepted from the
  client. All items of an order share one currency.
- Persistence uses `bigint` columns and a transformer to `number`. This is
  lossless because the domain guarantees safe integers.
- The API exchanges `{ "amount": 1999, "currency": "USD" }`.

## Consequences

- No rounding, and equality is exact.
- The currency code is validated by shape, not against the ISO 4217 list, and the
  number of minor-unit digits per currency (2 for USD, 0 for JPY, 3 for KWD) is
  not modelled. Presentation code must know the exponent. Add a currency table
  when you need display formatting or validation against real codes.
- Negative amounts (refunds, discounts) are intentionally not representable. Model
  them as separate domain concepts rather than negative prices.
- Percentage maths (tax, discounts) needs an explicit rounding policy that does
  not exist here. Add it as a named method on `Money`, not at call sites.
