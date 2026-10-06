import { Controller, Get, Put, Body } from '@nestjs/common';
import { PlansService } from './plans.service';
import { Roles } from '../auth/roles.decorator';

@Controller('api/plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get('settings')
  async getSettings() {
    return this.plansService.getPlanSettings();
  }

  @Roles('admin')
  @Put('settings')
  async updateSettings(@Body() data: any) {
    return this.plansService.updatePlanSettings(data);
  }
}
