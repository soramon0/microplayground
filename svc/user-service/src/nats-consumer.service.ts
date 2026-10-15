import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  AckPolicy,
  jetstream,
  jetstreamManager,
  type JetStreamClient,
} from '@nats-io/jetstream';
import { connect, type NatsConnection } from '@nats-io/transport-node';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class NatsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsConsumerService.name);
  private nc!: NatsConnection;
  private js!: JetStreamClient;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const servers = process.env.NATS_URL ?? 'nats://nats-service:4222';
    this.nc = await this.connectWithRetry(servers);
    this.js = jetstream(this.nc);
    this.logger.log(`Connected to NATS JetStream at ${servers}`);

    void this.consumeUserRegistrations();
  }

  private async consumeUserRegistrations() {
    const jsm = await jetstreamManager(this.nc);
    const durable = 'user-profile-consumer';

    try {
      await jsm.consumers.info('AUTH', durable);
    } catch {
      await jsm.consumers.add('AUTH', {
        durable_name: durable,
        filter_subject: 'AUTH.userRegistered',
        ack_policy: AckPolicy.Explicit,
      });
    }

    const consumer = await this.js.consumers.get('AUTH', durable);
    const messages = await consumer.consume();

    for await (const msg of messages) {
      try {
        const payload = JSON.parse(msg.string()) as {
          userId: string;
          email: string;
        };
        this.logger.log(`Creating profile for ${payload.userId}`);

        await this.prisma.ensureUserProfile({
          id: payload.userId,
          email: payload.email,
        });

        msg.ack();
      } catch (error) {
        this.logger.error('Failed to process user registration', error);
        // Intentionally do not ack — JetStream will redeliver.
      }
    }
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
