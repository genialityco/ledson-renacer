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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImagesService } from './images.service';
import { Roles } from '../auth/roles.decorator';

const MAX_UPLOAD_BYTES = 300 * 1024 * 1024; // 300MB — cubre videos largos de la pantalla de reposo/parrilla

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

  @Roles('admin')
  @Get('admin')
  async findAllAdmin() {
    return this.imagesService.findAllAdmin();
  }

  @Roles('admin')
  @Post('seed')
  async seed() {
    return this.imagesService.forceSeed();
  }

  @Roles('admin')
  @Post('upload-base64')
  async uploadBase64(@Body() data: { imageBase64: string; folder?: string }) {
    return this.imagesService.uploadImageBase64(data);
  }

  @Roles('admin')
  @Post('upload-file')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  async uploadFile(@UploadedFile() file: any, @Body('folder') folder?: string) {
    return this.imagesService.uploadImageFile(file, folder);
  }

  @Roles('admin')
  @Post()
  async create(@Body() data: any) {
    return this.imagesService.createFilter(data);
  }

  @Roles('admin')
  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.imagesService.updateFilter(id, data);
  }

  @Roles('admin')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.imagesService.updateFilter(id, { active: false }); // Soft delete
  }
}
