import { Module } from '@nestjs/common';
import { WompiController } from './wompi.controller';
import { WompiService } from './wompi.service';

@Module({
  controllers: [WompiController],
  providers: [WompiService],
  exports: [WompiService],
})
export class WompiModule {}
