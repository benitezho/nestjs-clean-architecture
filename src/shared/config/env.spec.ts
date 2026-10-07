import { validateEnv } from './env';

const valid = { DATABASE_URL: 'postgres://app:app@localhost:5432/app' };

describe('validateEnv', () => {
  it('applies defaults and coerces types', () => {
    const env = validateEnv({ ...valid, PORT: '8080', OUTBOX_RELAY_ENABLED: 'false' });

    expect(env.PORT).toBe(8080);
    expect(env.OUTBOX_RELAY_ENABLED).toBe(false);
    expect(env.OUTBOX_BATCH_SIZE).toBe(50);
    expect(env.NODE_ENV).toBe('development');
  });

  it('fails fast listing every problem', () => {
    expect(() => validateEnv({ PORT: 'abc', OUTBOX_RELAY_ENABLED: 'yes' })).toThrow(
      /DATABASE_URL[\s\S]*PORT[\s\S]*OUTBOX_RELAY_ENABLED|PORT[\s\S]*DATABASE_URL/,
    );
  });

  it('rejects a non-postgres URL', () => {
    expect(() => validateEnv({ DATABASE_URL: 'http://localhost' })).toThrow(/DATABASE_URL/);
  });
});
