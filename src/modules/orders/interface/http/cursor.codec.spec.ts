import { decodeCursor, encodeCursor, InvalidCursorError } from './cursor.codec';

describe('cursor codec', () => {
  it('round-trips a cursor', () => {
    const cursor = {
      placedAt: new Date('2026-01-15T10:00:00.123Z'),
      id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    };

    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it.each(['', 'not-base64-json', Buffer.from('{"p":1,"i":2}').toString('base64url')])(
    'rejects malformed token %p',
    (token) => {
      expect(() => decodeCursor(token)).toThrow(InvalidCursorError);
    },
  );
});
