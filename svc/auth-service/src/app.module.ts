import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { NatsService } from './nats.service.js';
import { PrismaService } from './prisma.service.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [PrismaService, NatsService, AuthService],
})
export class AppModule {}
