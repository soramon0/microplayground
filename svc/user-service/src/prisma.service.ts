import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { db } from './prisma/db.js';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly db = db;

  createUser(data: { email: string; role?: string }) {
    return this.db.orm.public.User.create({
      email: data.email,
      role: data.role ?? 'customer',
    });
  }

  findFirstUser() {
    return this.db.orm.public.User.first();
  }

  async onModuleDestroy() {
    await this.db.close();
  }
}
