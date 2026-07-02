import { Module } from '@nestjs/common';
import { DlocalgoController } from './dlocalgo.controller';
import { DlocalgoService } from './dlocalgo.service';

@Module({
  controllers: [DlocalgoController],
  providers: [DlocalgoService],
  exports: [DlocalgoService],
})
export class DlocalgoModule {}
