export class OutboxConfig {
  enabled!: boolean;
  pollIntervalMs!: number;
  batchSize!: number;
  maxAttempts!: number;
  backoffBaseMs!: number;
  backoffMaxMs!: number;
}
