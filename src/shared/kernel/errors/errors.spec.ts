import { ApplicationError } from './application-error';
import { BaseError } from './base-error';
import { DomainError } from './domain-error';

class RuleBroken extends DomainError {
  readonly kind = 'validation';
  readonly code = 'rule.broken';
}

class Missing extends ApplicationError {
  readonly kind = 'not_found';
  readonly code = 'thing.missing';
}

describe('kernel errors', () => {
  it('derives the name from the concrete class', () => {
    expect(new RuleBroken('x').name).toBe('RuleBroken');
    expect(new Missing('x').name).toBe('Missing');
  });

  it('is an Error and a BaseError for both flavours', () => {
    for (const error of [new RuleBroken('x'), new Missing('x')]) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BaseError);
    }
    expect(new RuleBroken('x')).toBeInstanceOf(DomainError);
    expect(new RuleBroken('x')).not.toBeInstanceOf(ApplicationError);
  });

  it('exposes kind, code, message and optional details', () => {
    const error = new RuleBroken('too big', { max: 3 });

    expect(error).toMatchObject({
      kind: 'validation',
      code: 'rule.broken',
      message: 'too big',
      details: { max: 3 },
    });
    expect(new Missing('x').details).toBeUndefined();
  });
});
