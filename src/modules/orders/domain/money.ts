import { CurrencyMismatchError, InvalidMoneyError } from './errors/order-errors';

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/**
 * Non-negative amount in the currency's minor unit (e.g. cents), as an
 * integer, plus an ISO 4217 alpha code. No floating point arithmetic.
 */
export class Money {
  private constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}

  static of(amount: number, currency: string): Money {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new InvalidMoneyError(`Amount must be a non-negative safe integer, got ${amount}`, {
        field: 'amount',
        value: amount,
      });
    }
    if (!CURRENCY_PATTERN.test(currency)) {
      throw new InvalidMoneyError(
        `Currency must be an ISO 4217 code like "USD", got "${currency}"`,
        { field: 'currency', value: currency },
      );
    }
    return new Money(amount, currency);
  }

  static zero(currency: string): Money {
    return Money.of(0, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amount + other.amount, this.currency);
  }

  multiply(factor: number): Money {
    if (!Number.isSafeInteger(factor) || factor < 0) {
      throw new InvalidMoneyError(`Factor must be a non-negative safe integer, got ${factor}`, {
        field: 'factor',
        value: factor,
      });
    }
    return Money.of(this.amount * factor, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  toString(): string {
    return `${this.amount} ${this.currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}
