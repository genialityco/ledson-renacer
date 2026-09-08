import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { BenefitsService } from './benefits.service';

@Controller('api/benefits')
export class BenefitsController {
  constructor(private readonly benefitsService: BenefitsService) {}

  @Get()
  async findAll() {
    return this.benefitsService.findAll();
  }

  @Get('admin')
  async findAllAdmin() {
    return this.benefitsService.findAllAdmin();
  }

  @Post()
  async create(@Body() data: any) {
    return this.benefitsService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.benefitsService.update(id, data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.benefitsService.update(id, { active: false }); // Soft delete
  }
}
