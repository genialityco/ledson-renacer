import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ImagesModule } from './images/images.module';
import { WompiModule } from './wompi/wompi.module';
import { FirebaseModule } from './firebase/firebase.module';
import { BookingsModule } from './bookings/bookings.module';
import { EmailModule } from './email/email.module';
import { SchedulesModule } from './schedules/schedules.module';
import { DlocalgoModule } from './dlocalgo/dlocalgo.module';
import { PlansModule } from './plans/plans.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    FirebaseModule,
    ImagesModule,
    WompiModule,
    BookingsModule,
    EmailModule,
    SchedulesModule,
    DlocalgoModule,
    PlansModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
