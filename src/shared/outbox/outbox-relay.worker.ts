import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { OutboxConfig } from './outbox.config';
import { OutboxRelay } from './outbox-relay';

/** Polls the outbox for the lifetime of the app and drains in-flight work on shutdown. */
@Injectable()
export class OutboxRelayWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayWorker.name);
  private stopping = false;
  private loop?: Promise<void>;
  private wake?: () => void;

  constructor(
    private readonly relay: OutboxRelay,
    private readonly config: OutboxConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.enabled) {
      this.logger.log('Outbox relay disabled');
      return;
    }
    this.loop = this.run();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    this.wake?.();
    await this.loop;
  }

  private async run(): Promise<void> {
    while (!this.stopping) {
      const claimed = await this.tick();
      if (!this.stopping && claimed < this.config.batchSize) {
        await this.sleep(this.config.pollIntervalMs);
      }
    }
  }

  private async tick(): Promise<number> {
    try {
      return (await this.relay.processBatch()).claimed;
    } catch (error) {
      this.logger.error({ msg: 'outbox batch failed', error: String(error) });
      return 0;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }
}
