import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

@Injectable()
export class SurveyService {
  async createAnswer(dto: { questionId: string; value: string; userId?: string }) {
    const q = await prisma.question.findUnique({ where: { id: dto.questionId } });
    if (!q) throw new NotFoundException('Question not found');
    return prisma.answer.create({ data: dto });
  }

  async seed() {
    const survey = await prisma.survey.create({ data: { title: 'MVP Survey' } });
    const question = await prisma.question.create({
      data: { text: 'NPS', type: 'nps', order: 1, surveyId: survey.id },
    });
    return { surveyId: survey.id, questionId: question.id };
  }

  async listQuestions() {
    return prisma.question.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
