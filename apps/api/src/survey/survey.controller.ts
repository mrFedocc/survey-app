import { Body, Controller, Get, Param, Post, Res, Query } from '@nestjs/common';
import { Response } from 'express';
import { SurveyService } from './survey.service';

@Controller('survey')
export class SurveyController {
  constructor(private readonly service: SurveyService) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('start')
  start() {
    return this.service.start();
  }

  @Get('question/:id')
  question(@Param('id') id: string) {
    return this.service.getQuestion(id);
  }

  @Post('answer')
  answer(@Body() body: { userId?: string; questionId: string; value: string }) {
    return this.service.answer(body);
  }

  @Post('lead')
  lead(
    @Body()
    body: {
      surveyId?: string;
      userId: string;
      choices: { preorder: boolean; partner: boolean };
      email?: string;
      telegram?: string;
    },
  ) {
    return this.service.saveLead(body);
  }

  // Если surveyId не задан -> сводка по всем опросам (ваш сценарий "всегда вся статистика")
  @Get('stats')
  stats(@Query('surveyId') surveyId?: string) {
    return this.service.stats(surveyId);
  }

  @Post('seed-full')
  seedFull() {
    return this.service.seedFull();
  }

  @Get('export.csv')
  async exportCsv(@Res() res: Response, @Query('surveyId') surveyId?: string) {
    const csv = await this.service.exportCsv(surveyId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="answers.csv"');
    return res.send(csv);
  }

  @Get('export-wide.csv')
  async exportWide(@Res() res: Response, @Query('surveyId') surveyId?: string) {
    const csv = await this.service.exportWideCsv(surveyId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="answers_wide.csv"',
    );
    return res.send(csv);
  }

  @Get('surveys')
  listSurveys() {
    return this.service.listSurveys();
  }

  @Get('export-all.csv')
  async exportAll(@Res() res: Response) {
    const csv = await this.service.exportAllCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="answers_all.csv"');
    return res.send(csv);
  }

  @Get('export-all-wide.csv')
  async exportAllWide(@Res() res: Response) {
    const csv = await this.service.exportAllWideCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="answers_all_wide.csv"',
    );
    return res.send(csv);
  }
}
