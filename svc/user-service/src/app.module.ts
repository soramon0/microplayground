import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { NatsConsumerService } from './nats-consumer.service.js';
import { PrismaService } from './prisma.service.js';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [PrismaService, NatsConsumerService],
})
export class AppModule {}
