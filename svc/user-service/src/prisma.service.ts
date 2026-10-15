import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { db } from './prisma/db.js';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly db = db;

  createUser(data: { email: string; role?: string; id?: string }) {
    return this.db.orm.public.User.create({
      ...(data.id ? { id: data.id } : {}),
      email: data.email,
      role: data.role ?? 'customer',
    });
  }

  findFirstUser() {
    return this.db.orm.public.User.first();
  }

  findUserById(id: string) {
    return this.db.orm.public.User.first({ id });
  }

  /** Idempotent profile create for AUTH.userRegistered consumers. */
  async ensureUserProfile(data: { id: string; email: string }) {
    const existing = await this.findUserById(data.id);
    if (existing) {
      return existing;
    }
    return this.createUser({ id: data.id, email: data.email });
  }

  async onModuleDestroy() {
    await this.db.close();
  }
}
