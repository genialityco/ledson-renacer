import { Controller, Post, Body, Get, Put, Param } from '@nestjs/common';
import { BookingsService } from './bookings.service';

@Controller('api/bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('screen-settings')
  async getScreenSettings() {
    return this.bookingsService.getScreenSettings();
  }

  @Get('search/:query')
  async searchBookings(@Param('query') query: string) {
    return this.bookingsService.searchBookings(query);
  }

  @Put('screen-settings')
  async updateScreenSettings(@Body() data: any) {
    return this.bookingsService.updateScreenSettings(data);
  }

  @Post('screen-settings/clear')
  async clearProjection() {
    return this.bookingsService.clearProjection();
  }

  @Get()
  async getAll() {
    return this.bookingsService.getBookings();
  }

  @Post('init')
  async initBooking(@Body() data: any) {
    return this.bookingsService.initBooking(data);
  }

  @Post(':id/confirm-payment')
  async confirmPayment(@Param('id') id: string, @Body() data?: { imageBase64?: string }) {
    return this.bookingsService.confirmPayment(id, data);
  }

  @Post()
  async createBooking(@Body() data: any) {
    return this.bookingsService.createBooking(data);
  }

  @Post(':id/generate')
  async generateImage(@Param('id') id: string) {
    return this.bookingsService.generateImage(id);
  }

  @Post(':id/project')
  async projectBooking(@Param('id') id: string) {
    return this.bookingsService.projectBooking(id);
  }

  @Post(':id/complete')
  async completeProjection(@Param('id') id: string) {
    return this.bookingsService.completeProjection(id);
  }

  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.bookingsService.updateBookingStatus(id, status);
  }
}
