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
import { Roles } from '../auth/roles.decorator';

@Controller('api/schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Roles('admin')
  @Get('templates')
  async getTemplates() {
    return this.schedulesService.getTemplates();
  }

  @Get('settings')
  async getScheduleSettings() {
    return this.schedulesService.getScheduleSettings();
  }

  @Roles('admin')
  @Put('settings')
  async updateScheduleSettings(@Body() data: any) {
    return this.schedulesService.updateScheduleSettings(data);
  }

  @Roles('admin')
  @Post('templates')
  async saveTemplate(@Body() data: any) {
    return this.schedulesService.saveTemplate(data);
  }

  @Roles('admin')
  @Delete('templates/:id')
  async deleteTemplate(@Param('id') id: string) {
    return this.schedulesService.deleteTemplate(id);
  }

  @Get('daily')
  async getDailySchedule(@Query('date') dateStr: string) {
    return this.schedulesService.getScheduleForDate(dateStr);
  }

  @Roles('admin')
  @Post('daily')
  async saveDailySchedule(
    @Body() data: { date: string; slots: any[]; deadTimes: any[] },
  ) {
    return this.schedulesService.saveScheduleForDate(data.date, {
      slots: data.slots,
      deadTimes: data.deadTimes,
    });
  }

  @Roles('admin')
  @Post('apply-template')
  async applyTemplate(@Body() data: { templateId: string; dates: string[] }) {
    return this.schedulesService.applyTemplateToDates(
      data.templateId,
      data.dates,
    );
  }
}
