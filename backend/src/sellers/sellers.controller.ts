import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { SellersService } from './sellers.service';

@Controller('api/sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  async findAll() {
    return this.sellersService.findAll();
  }

  @Get('admin')
  async findAllAdmin() {
    return this.sellersService.findAllAdmin();
  }

  @Post()
  async create(@Body() data: any) {
    return this.sellersService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.sellersService.update(id, data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.sellersService.update(id, { active: false }); // Soft delete
  }
}
