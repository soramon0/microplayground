import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { db } from './prisma/db.js';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly db = db;

  findCredentialByEmail(email: string) {
    return this.db.orm.public.Credential.where({ email }).first();
  }

  createCredential(data: { email: string; passwordHash: string }) {
    return this.db.orm.public.Credential.create({
      email: data.email,
      passwordHash: data.passwordHash,
    });
  }

  async onModuleDestroy() {
    await this.db.close();
  }
}
