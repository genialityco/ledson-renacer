import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { GoogleVisionModerationService } from './google-vision-moderation.service';

@Module({
  controllers: [ModerationController],
  providers: [ModerationService, GoogleVisionModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
