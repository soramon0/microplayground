import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { connect, type NatsConnection } from '@nats-io/transport-node';
import {
  jetstream,
  jetstreamManager,
  JetStreamApiCodes,
  JetStreamApiError,
  type JetStreamClient,
} from '@nats-io/jetstream';

@Injectable()
export class NatsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsService.name);
  private nc!: NatsConnection;
  private js!: JetStreamClient;

  async onModuleInit() {
    const servers = process.env.NATS_URL ?? 'nats://nats-service:4222';
    this.nc = await this.connectWithRetry(servers);
    this.js = jetstream(this.nc);

    const jsm = await jetstreamManager(this.nc);
    try {
      await jsm.streams.info('AUTH');
    } catch (err) {
      if (
        err instanceof JetStreamApiError &&
        err.code === JetStreamApiCodes.StreamNotFound
      ) {
        await jsm.streams.add({
          name: 'AUTH',
          subjects: ['AUTH.*'],
        });
      } else {
        throw err;
      }
    }

    this.logger.log(`Connected to NATS JetStream at ${servers}`);
  }

  async publishUserRegistered(userId: string, email: string) {
    const payload = JSON.stringify({ userId, email });
    await this.js.publish('AUTH.userRegistered', payload);
    this.logger.log(`Published AUTH.userRegistered for ${userId}`);
  }

  async onModuleDestroy() {
    await this.nc?.close();
  }

  private async connectWithRetry(servers: string): Promise<NatsConnection> {
    const maxAttempts = 30;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await connect({ servers });
      } catch (err) {
        lastError = err;
        this.logger.warn(
          `NATS connect attempt ${attempt}/${maxAttempts} failed; retrying…`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Failed to connect to NATS at ${servers}`);
  }
}
