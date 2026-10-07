import { CurrencyMismatchError, InvalidMoneyError } from './errors/order-errors';
import { Money } from './money';

describe('Money', () => {
  it('holds an integer amount of minor units and a currency', () => {
    const price = Money.of(1999, 'USD');

    expect(price.amount).toBe(1999);
    expect(price.currency).toBe('USD');
  });

  it.each([1.5, -1, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('rejects amount %p', (amount) => {
    expect(() => Money.of(amount, 'USD')).toThrow(InvalidMoneyError);
  });

  it.each(['usd', 'US', 'USDX', ''])('rejects currency %p', (currency) => {
    expect(() => Money.of(100, currency)).toThrow(InvalidMoneyError);
  });

  it('adds amounts of the same currency', () => {
    expect(Money.of(150, 'EUR').add(Money.of(250, 'EUR')).equals(Money.of(400, 'EUR'))).toBe(true);
  });

  it('refuses to add different currencies', () => {
    expect(() => Money.of(1, 'EUR').add(Money.of(1, 'USD'))).toThrow(CurrencyMismatchError);
  });

  it('multiplies by an integer factor', () => {
    expect(Money.of(333, 'USD').multiply(3).amount).toBe(999);
  });

  it('rejects a fractional factor', () => {
    expect(() => Money.of(100, 'USD').multiply(0.5)).toThrow(InvalidMoneyError);
  });

  it('rejects results beyond the safe integer range', () => {
    expect(() => Money.of(Number.MAX_SAFE_INTEGER, 'USD').add(Money.of(1, 'USD'))).toThrow(
      InvalidMoneyError,
    );
  });

  it('compares by value', () => {
    expect(Money.of(5, 'USD').equals(Money.of(5, 'USD'))).toBe(true);
    expect(Money.of(5, 'USD').equals(Money.of(5, 'EUR'))).toBe(false);
  });
});
