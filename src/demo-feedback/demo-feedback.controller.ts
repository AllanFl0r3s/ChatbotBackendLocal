import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/guards/admin.guard';
import { DemoFeedbackDto, FeedbackPageDto } from './demo-feedback.dto';
import { DemoFeedbackService } from './demo-feedback.service';

@Controller('demo-feedback')
@UseGuards(AuthGuard('jwt'))
export class DemoFeedbackController {
  constructor(private readonly feedback: DemoFeedbackService) {}
  @Post()
  submit(@Req() req: any, @Body() dto: DemoFeedbackDto) {
    return this.feedback.submit(req.user.userId, dto);
  }
  @Get()
  @UseGuards(AdminGuard)
  report(@Query() query: FeedbackPageDto) { return this.feedback.report(query.page); }
}
