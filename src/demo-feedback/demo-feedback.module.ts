import { Module } from '@nestjs/common';
import { DemoFeedbackController } from './demo-feedback.controller';
import { DemoFeedbackService } from './demo-feedback.service';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({ controllers: [DemoFeedbackController], providers: [DemoFeedbackService, AdminGuard] })
export class DemoFeedbackModule {}
