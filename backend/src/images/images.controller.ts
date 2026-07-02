import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ImagesService } from './images.service';

@Controller('api/images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Get('proxy')
  async proxyImage(@Query('url') url: string, @Res() res: Response) {
    try {
      if (!url) return res.status(400).send('URL is required');
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`Failed to fetch image: ${response.status}`);
      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.send(Buffer.from(buffer));
    } catch (e: any) {
      res.status(500).send(e.message);
    }
  }

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
