import { ApplicationError } from '../../../../shared/kernel/errors/application-error';
import type { OrderCursor } from '../../application/ports/order.repository';

export class InvalidCursorError extends ApplicationError {
  readonly kind = 'bad_request';
  readonly code = 'pagination.invalid_cursor';

  constructor() {
    super('The pagination cursor is malformed');
  }
}

export function encodeCursor(cursor: OrderCursor): string {
  const json = JSON.stringify({ p: cursor.placedAt.toISOString(), i: cursor.id });
  return Buffer.from(json).toString('base64url');
}

export function decodeCursor(token: string): OrderCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    const { p, i } = parsed as { p?: unknown; i?: unknown };
    const placedAt = new Date(typeof p === 'string' ? p : Number.NaN);
    if (Number.isNaN(placedAt.getTime()) || typeof i !== 'string') {
      throw new InvalidCursorError();
    }
    return { placedAt, id: i };
  } catch {
    throw new InvalidCursorError();
  }
}
