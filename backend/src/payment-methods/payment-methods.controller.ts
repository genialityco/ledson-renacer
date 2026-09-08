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

@Controller('api/payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get()
  async findAll() {
    return this.paymentMethodsService.findAll();
  }

  @Get('admin')
  async findAllAdmin() {
    return this.paymentMethodsService.findAllAdmin();
  }

  @Post()
  async create(@Body() data: any) {
    return this.paymentMethodsService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.paymentMethodsService.update(id, data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.paymentMethodsService.update(id, { active: false }); // Soft delete
  }
}
