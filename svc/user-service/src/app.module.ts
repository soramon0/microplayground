import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { PrismaService } from './prisma.service.js';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [PrismaService],
})
export class AppModule {}
