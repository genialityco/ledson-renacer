import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { DlocalgoService } from './dlocalgo.service';

@Controller('api/dlocalgo')
export class DlocalgoController {
  constructor(private dlocalgo: DlocalgoService) {}

  @Post('create-link')
  async createLink(
    @Body('amount') amount: number,
    @Body('currency') currency: string,
    @Body('reference') reference: string,
    @Body('successUrl') successUrl: string,
    @Body('backUrl') backUrl: string,
  ) {
    return this.dlocalgo.createPaymentLink(
      amount,
      currency || 'COP',
      reference,
      successUrl,
      backUrl,
    );
  }

  @Get('status/:id')
  async getStatus(@Param('id') id: string) {
    return this.dlocalgo.getPaymentStatus(id);
  }
}
