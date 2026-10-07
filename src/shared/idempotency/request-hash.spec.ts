import { hashRequest } from './request-hash';

describe('hashRequest', () => {
  it('ignores object key order, at any depth', () => {
    const a = { customerId: 'c', items: [{ sku: 'a', quantity: 1 }] };
    const b = { items: [{ quantity: 1, sku: 'a' }], customerId: 'c' };

    expect(hashRequest(a)).toBe(hashRequest(b));
  });

  it('is sensitive to values and to array order', () => {
    expect(hashRequest({ a: 1 })).not.toBe(hashRequest({ a: 2 }));
    expect(hashRequest([1, 2])).not.toBe(hashRequest([2, 1]));
  });

  it('treats undefined properties as absent', () => {
    expect(hashRequest({ a: 1, b: undefined })).toBe(hashRequest({ a: 1 }));
  });
});
