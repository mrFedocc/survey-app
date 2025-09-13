import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SurveyModule } from './survey/survey.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SurveyModule],
})
export class AppModule {}
