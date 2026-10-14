import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Controller('users')
export class AppController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post('create')
  async createUser(@Body() body: { email: string; role?: string }) {
    const savedUser = await this.prisma.createUser({
      email: body.email,
      role: body.role,
    });
    return { message: 'User created successfully', user: savedUser };
  }

  @Get('verify')
  async verifyUser() {
    const user = await this.prisma.findFirstUser();

    if (!user) {
      return { valid: false, message: 'No users in database' };
    }
    return { valid: true, userId: user.id, role: user.role };
  }
}
