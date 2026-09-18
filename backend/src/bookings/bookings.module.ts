import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { EmailModule } from '../email/email.module';
import { WompiModule } from '../wompi/wompi.module';
import { DlocalgoModule } from '../dlocalgo/dlocalgo.module';

@Module({
  imports: [EmailModule, WompiModule, DlocalgoModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
