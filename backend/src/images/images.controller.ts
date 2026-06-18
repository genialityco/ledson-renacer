import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ImagesService } from './images.service';

@Controller('api/images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Get()
  async findAll() {
    return this.imagesService.findAll();
  }

  @Get('admin')
  async findAllAdmin() {
    return this.imagesService.findAllAdmin();
  }

  @Post('seed')
  async seed() {
    return this.imagesService.forceSeed();
  }

  @Post('upload-base64')
  async uploadBase64(@Body() data: { imageBase64: string; folder?: string }) {
    return this.imagesService.uploadImageBase64(data);
  }

  @Post()
  async create(@Body() data: any) {
    return this.imagesService.createFilter(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.imagesService.updateFilter(id, data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.imagesService.updateFilter(id, { active: false }); // Soft delete
  }
}
