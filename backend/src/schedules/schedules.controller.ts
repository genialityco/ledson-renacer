import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';

@Controller('api/schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('templates')
  async getTemplates() {
    return this.schedulesService.getTemplates();
  }

  @Get('settings')
  async getScheduleSettings() {
    return this.schedulesService.getScheduleSettings();
  }

  @Put('settings')
  async updateScheduleSettings(@Body() data: any) {
    return this.schedulesService.updateScheduleSettings(data);
  }

  @Post('templates')
  async saveTemplate(@Body() data: any) {
    return this.schedulesService.saveTemplate(data);
  }

  @Delete('templates/:id')
  async deleteTemplate(@Param('id') id: string) {
    return this.schedulesService.deleteTemplate(id);
  }

  @Get('daily')
  async getDailySchedule(@Query('date') dateStr: string) {
    return this.schedulesService.getScheduleForDate(dateStr);
  }

  @Post('daily')
  async saveDailySchedule(
    @Body() data: { date: string; slots: any[]; deadTimes: any[] },
  ) {
    return this.schedulesService.saveScheduleForDate(data.date, {
      slots: data.slots,
      deadTimes: data.deadTimes,
    });
  }

  @Post('apply-template')
  async applyTemplate(@Body() data: { templateId: string; dates: string[] }) {
    return this.schedulesService.applyTemplateToDates(
      data.templateId,
      data.dates,
    );
  }
}
