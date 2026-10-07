import { InvalidOrderIdError } from './errors/order-errors';
import { OrderId } from './order-id';

describe('OrderId', () => {
  it('accepts a UUID and normalises it to lower case', () => {
    const id = OrderId.from('3F2504E0-4F89-41D3-9A0C-0305E82C3301');

    expect(id.value).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  });

  it('rejects anything that is not a UUID', () => {
    expect(() => OrderId.from('order-1')).toThrow(InvalidOrderIdError);
  });

  it('compares by value', () => {
    const raw = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

    expect(OrderId.from(raw).equals(OrderId.from(raw))).toBe(true);
  });
});
