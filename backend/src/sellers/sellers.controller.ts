import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { SellersService } from './sellers.service';
import { Roles } from '../auth/roles.decorator';

@Controller('api/sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  async findAll() {
    return this.sellersService.findAll();
  }

  @Roles('admin')
  @Get('admin')
  async findAllAdmin() {
    return this.sellersService.findAllAdmin();
  }

  @Roles('admin')
  @Post()
  async create(@Body() data: any) {
    return this.sellersService.create(data);
  }

  @Roles('admin')
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.sellersService.update(id, data);
  }

  @Roles('admin')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.sellersService.update(id, { active: false }); // Soft delete
  }
}
