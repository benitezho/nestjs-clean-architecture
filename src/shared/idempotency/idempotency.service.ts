import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../database/transaction-manager';
import { IdempotencyKeyReuseError, InvalidIdempotencyKeyError } from './idempotency.errors';

export interface IdempotentRequest {
  scope: string;
  key: string;
  requestHash: string;
}

export interface StoredResponse {
  status: number;
  body: Record<string, unknown>;
}

export interface IdempotentResult {
  replayed: boolean;
  response: StoredResponse;
}

const VALID_KEY = /^[\x21-\x7E]{1,255}$/;

@Injectable()
export class IdempotencyService {
  constructor(private readonly transactions: TransactionManager) {}

  /**
   * Runs `handler` at most once per (scope, key). The key row and whatever the
   * handler writes commit together; if the handler throws, both roll back and
   * the key stays unused. A concurrent request with the same key blocks on the
   * unique index until the first one finishes, then replays its response.
   */
  async execute(
    request: IdempotentRequest,
    handler: () => Promise<StoredResponse>,
  ): Promise<IdempotentResult> {
    if (!VALID_KEY.test(request.key)) {
      throw new InvalidIdempotencyKeyError();
    }
    return this.transactions.run(async () => {
      if (!(await this.claim(request))) {
        return { replayed: true, response: await this.load(request) };
      }
      const response = await handler();
      await this.store(request, response);
      return { replayed: false, response };
    });
  }

  private async claim({ scope, key, requestHash }: IdempotentRequest): Promise<boolean> {
    const rows: unknown[] = await this.transactions.manager.query(
      `INSERT INTO idempotency_keys (scope, key, request_hash) VALUES ($1, $2, $3)
       ON CONFLICT (scope, key) DO NOTHING RETURNING key`,
      [scope, key, requestHash],
    );
    return rows.length === 1;
  }

  private async load({ scope, key, requestHash }: IdempotentRequest): Promise<StoredResponse> {
    const [row] = await this.transactions.manager.query<
      { request_hash: string; response_status: number; response_body: Record<string, unknown> }[]
    >(
      `SELECT request_hash, response_status, response_body FROM idempotency_keys
        WHERE scope = $1 AND key = $2`,
      [scope, key],
    );
    if (!row || row.request_hash !== requestHash) {
      throw new IdempotencyKeyReuseError();
    }
    return { status: row.response_status, body: row.response_body };
  }

  private async store({ scope, key }: IdempotentRequest, response: StoredResponse): Promise<void> {
    await this.transactions.manager.query(
      `UPDATE idempotency_keys SET response_status = $3, response_body = $4
        WHERE scope = $1 AND key = $2`,
      [scope, key, response.status, JSON.stringify(response.body)],
    );
  }
}
