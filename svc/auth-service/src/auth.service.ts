import { ConflictException, Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { NatsService } from './nats.service.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NatsService) private readonly nats: NatsService,
  ) {}

  async register(email: string, passwordPlain: string) {
    const existing = await this.prisma.findCredentialByEmail(email);

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);

    const credential = await this.prisma.createCredential({
      email,
      passwordHash,
    });

    // TODO: the Outbox Pattern
    await this.nats.publishUserRegistered(credential.id, credential.email);

    return { message: 'Registration successful', userId: credential.id };
  }
}
