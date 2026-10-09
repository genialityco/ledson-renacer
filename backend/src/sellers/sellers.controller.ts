import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { SellersService } from './sellers.service';
import type { SellerInput } from './sellers.service';
import { Roles } from '../auth/roles.decorator';
import type { AuthedRequest } from '../auth/auth.guard';

@Controller('api/sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  async findAll() {
    return this.sellersService.findAll();
  }

  // Vendedor vinculado a la cuenta con sesión iniciada. `locked`: un
  // vendedor no puede registrar ventas a nombre de otro (ver createBooking);
  // un admin vinculado solo lo trae preseleccionado.
  @Roles('vendedor')
  @Get('me')
  async findMine(@Req() req: AuthedRequest) {
    const seller = await this.sellersService.findByUid(req.user?.uid ?? '');
    return { seller, locked: !!seller && req.user?.role !== 'admin' };
  }

  @Roles('admin')
  @Get('admin')
  async findAllAdmin() {
    return this.sellersService.findAllAdmin();
  }

  @Roles('admin')
  @Post()
  async create(@Body() data: SellerInput) {
    return this.sellersService.create(data);
  }

  @Roles('admin')
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: SellerInput) {
    return this.sellersService.update(id, data);
  }

  @Roles('admin')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.sellersService.update(id, { active: false }); // Soft delete
  }
}
