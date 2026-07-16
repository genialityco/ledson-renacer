import { Controller, Get, Put, Body } from '@nestjs/common';
import { PlansService } from './plans.service';

@Controller('api/plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get('settings')
  async getSettings() {
    return this.plansService.getPlanSettings();
  }

  @Put('settings')
  async updateSettings(@Body() data: any) {
    return this.plansService.updatePlanSettings(data);
  }
}
