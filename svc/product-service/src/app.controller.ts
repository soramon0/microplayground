import { Controller, Get, Param, NotFoundException } from '@nestjs/common';

@Controller('products')
export class AppController {
  @Get(':id')
  getProduct(@Param('id') id: string) {
    console.log(`Product info requested for ID: ${id}`);
    if (id === '99') {
      return { id: 99, name: 'Mechanical Keyboard', price: 150, inStock: true };
    }
    throw new NotFoundException('Product not found');
  }
}
