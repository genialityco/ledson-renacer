import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { Roles } from '../auth/roles.decorator';

@Controller('api/payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get()
  async findAll() {
    return this.paymentMethodsService.findAll();
  }

  @Roles('admin')
  @Get('admin')
  async findAllAdmin() {
    return this.paymentMethodsService.findAllAdmin();
  }

  @Roles('admin')
  @Post()
  async create(@Body() data: any) {
    return this.paymentMethodsService.create(data);
  }

  @Roles('admin')
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.paymentMethodsService.update(id, data);
  }

  @Roles('admin')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.paymentMethodsService.update(id, { active: false }); // Soft delete
  }
}
