import { Body, Controller, Get, Post } from '@nestjs/common';
import { SurveyService } from './survey.service';

@Controller('survey')
export class SurveyController {
  constructor(private readonly service: SurveyService) {}

  @Get('health')
  health() { return { ok: true }; }

  @Post('answer')
  answer(@Body() body: { questionId: string; value: string; userId?: string }) {
    return this.service.createAnswer(body);
  }

  @Post('seed')
  seed() { return this.service.seed(); }

  @Get('questions')
  questions() { return this.service.listQuestions(); }
}
