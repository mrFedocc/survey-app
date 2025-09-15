import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const leadKey = (surveyId?: string | null, userId?: string | null) =>
  `${surveyId ?? ''}::${userId ?? ''}`;

type MultiPayload = { selected: string[]; other?: string };

@Injectable()
export class SurveyService {
  async start() {
    const survey = await prisma.survey.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { questions: true },
    });
    if (!survey) return { surveyId: null, questionId: null };

    const first =
      survey.firstQuestionId ??
      survey.questions.sort((a, b) => a.order - b.order)[0]?.id ??
      null;

    return { surveyId: survey.id, questionId: first };
  }

  async getQuestion(id: string) {
    const q = await prisma.question.findUnique({
      where: { id },
      include: { options: true },
    });
    if (!q) throw new NotFoundException('Question not found');
    return q;
  }

  /**
   * Сохранить ответ и вернуть nextQuestionId.
   * Особый случай: если в Q1 выбрали "none" (Нет питомцев), опрос завершаем БЕЗ записи ответа.
   */
  async answer(dto: { userId?: string; questionId: string; value: string }) {
    const q = await prisma.question.findUnique({
      where: { id: dto.questionId },
      include: { options: true, survey: { include: { questions: true } } },
    });
    if (!q) throw new NotFoundException('Question not found');

    // Q1: "Нет" — завершаем без записи (ценная бизнес-логика из твоей версии)
    const isQ1PetsSingle =
      q.type === 'single' && q.options.some((o) => o.value === 'pets_none');
    if (isQ1PetsSingle && dto.value === 'pets_none') {
      return { nextQuestionId: null };
    }

    // Сохраняем ответ
    await prisma.answer.create({ data: dto });

    // Определяем следующий вопрос
    let nextQuestionId: string | null = null;

    if (q.type === 'single') {
      const chosen = q.options.find((o) => o.value === dto.value);
      nextQuestionId = chosen?.nextQuestionId ?? null;
    } else if (q.type === 'multi') {
      try {
        const payload: MultiPayload = JSON.parse(dto.value);
        const opt = q.options.find(
          (o) => payload.selected?.includes(o.value) && o.nextQuestionId,
        );
        nextQuestionId = opt?.nextQuestionId ?? null;
      } catch {
        // игнор
      }
    }

    if (!nextQuestionId) {
      const sorted = q.survey.questions.sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((x) => x.id === q.id);
      nextQuestionId = sorted[idx + 1]?.id ?? null;
    }

    return { nextQuestionId };
  }

  async saveLead(dto: {
    surveyId?: string;
    userId: string;
    choices: { preorder: boolean; partner: boolean };
    email?: string;
    telegram?: string;
  }) {
    return prisma.lead.create({
      data: {
        surveyId: dto.surveyId ?? null,
        userId: dto.userId,
        choices: JSON.stringify(dto.choices),
        email: dto.email,
        telegram: dto.telegram,
      },
    });
  }

  private async getActiveSurvey(surveyId?: string) {
    if (surveyId) {
      const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
      if (!survey) throw new Error(`Survey ${surveyId} not found`);
      return survey;
    }
    const survey = await prisma.survey.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!survey) throw new Error('No surveys found');
    return survey;
  }

  async listSurveys() {
    return prisma.survey.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, createdAt: true, firstQuestionId: true },
    });
  }

  /** 1) Структурный CSV: построчно по ответам, с расшифровкой и контактами */
  async exportCsv(surveyId?: string) {
    const active = await this.getActiveSurvey(surveyId);

    const answers = await prisma.answer.findMany({
      orderBy: { createdAt: 'desc' },
      where: { question: { surveyId: active.id } },
      include: { question: { include: { options: true } } },
    });

    const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
    const leadByKey = new Map(leads.map((l) => [leadKey(l.surveyId, l.userId), l]));

    const header = [
      'createdAt',
      'userId',
      'question',
      'type',
      'answer_value',
      'answer_label',
      'multi_selected',
      'multi_labels',
      'multi_other',
      'lead_email',
      'lead_telegram',
      'lead_preorder',
      'lead_partner',
    ];
    const lines = [header.join(',')];

    const csv = (s: string) =>
      s && (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? `"${s.replace(/"/g, '""')}"`
        : s ?? '';

    for (const r of answers) {
      let answerLabel = '',
        multiSelected = '',
        multiLabels = '',
        multiOther = '';

      if (r.question.type === 'single') {
        const opt = r.question.options.find((o) => o.value === r.value);
        answerLabel = opt?.label ?? '';
      } else if (r.question.type === 'multi') {
        try {
          const parsed = JSON.parse(r.value) as { selected?: string[]; other?: string };
          const sel = parsed.selected ?? [];
          multiSelected = sel.join('|');
          multiLabels = sel
            .map((v) => r.question.options.find((o) => o.value === v)?.label ?? v)
            .join('|');
          multiOther = parsed.other ?? '';
        } catch {}
      }

      let email = '',
        telegram = '',
        preorder = '',
        partner = '';
      const lead = leadByKey.get(leadKey(active.id, r.userId ?? ''));
      if (lead) {
        email = lead.email ?? '';
        telegram = lead.telegram ?? '';
        try {
          const c = JSON.parse(lead.choices ?? '{}') as {
            preorder?: boolean;
            partner?: boolean;
          };
          preorder = c.preorder ? '1' : '0';
          partner = c.partner ? '1' : '0';
        } catch {}
      }

      lines.push(
        [
          r.createdAt.toISOString(),
          csv(r.userId ?? ''),
          csv(r.question.text),
          r.question.type,
          csv(r.value),
          csv(answerLabel),
          csv(multiSelected),
          csv(multiLabels),
          csv(multiOther),
          csv(email),
          csv(telegram),
          preorder,
          partner,
        ].join(','),
      );
    }

    return lines.join('\n');
  }

  /** 2) Широкий CSV: 1 строка = 1 userId (в рамках конкретного survey) */
  async exportWideCsv(surveyId?: string) {
    const active = await this.getActiveSurvey(surveyId);

    const questions = await prisma.question.findMany({
      where: { surveyId: active.id },
      orderBy: { order: 'asc' },
      include: { options: true },
    });

    const answers = await prisma.answer.findMany({
      where: { question: { surveyId: active.id } },
      orderBy: { createdAt: 'asc' },
      include: { question: { include: { options: true } } },
    });

    const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
    const leadByKey = new Map(leads.map((l) => [leadKey(l.surveyId, l.userId), l]));

    const byUser = new Map<string, typeof answers>();
    for (const a of answers) {
      const key = a.userId ?? '(anonymous)';
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key)!.push(a);
    }

    const header = [
      'userId',
      ...questions.map((q) => q.text),
      'contact_email',
      'contact_telegram',
      'choice_preorder',
      'choice_partner',
    ];

    const csv = (s: string) =>
      s && (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? `"${s.replace(/"/g, '""')}"`
        : s ?? '';

    const lines = [header.map(csv).join(',')];

    for (const [uid, list] of byUser) {
      const dict = new Map<string, string>();

      for (const r of list) {
        if (r.question.type === 'single') {
          const opt = r.question.options.find((o) => o.value === r.value);
          dict.set(r.questionId, opt?.label ?? r.value);
        } else if (r.question.type === 'multi') {
          try {
            const parsed = JSON.parse(r.value) as { selected?: string[]; other?: string };
            const labels = (parsed.selected ?? []).map(
              (v) => r.question.options.find((o) => o.value === v)?.label ?? v,
            );
            const combined = [...labels, parsed.other ?? ''].filter(Boolean).join(' | ');
            dict.set(r.questionId, combined);
          } catch {
            dict.set(r.questionId, r.value);
          }
        } else {
          dict.set(r.questionId, r.value);
        }
      }

      let email = '',
        telegram = '',
        preorder = '',
        partner = '';
      const lead = leadByKey.get(leadKey(active.id, uid === '(anonymous)' ? '' : uid));
      if (lead) {
        email = lead.email ?? '';
        telegram = lead.telegram ?? '';
        try {
          const c = JSON.parse(lead.choices ?? '{}') as {
            preorder?: boolean;
            partner?: boolean;
          };
          preorder = c.preorder ? '1' : '0';
          partner = c.partner ? '1' : '0';
        } catch {}
      }

      const row = [
        csv(uid),
        ...questions.map((q) => csv(dict.get(q.id) ?? '')),
        csv(email),
        csv(telegram),
        preorder,
        partner,
      ];

      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  // ====== ГЛОБАЛЬНАЯ/ПЕР-СУРВЕЙ СВОДКА (без “сохранить последний”) ======
  /**
   * Если surveyId передан -> сводка только для этого опроса.
   * Если surveyId НЕ передан -> сводка по ВСЕМ опросам (ваш запрос “всегда вся статистика”).
   *
   * Агрегируем по значениям `value`, а не по текстам вопросов:
   * pets_* / <18|18-30|30-50|50< / yes|no / '2000-5000' и т.п. / multi.selected.
   */
  async stats(surveyId?: string) {
    const whereBySurvey = surveyId ? { question: { surveyId } as any } : {};

    // Собираем все ответы в рамках фильтра
    const answers = await prisma.answer.findMany({
      where: whereBySurvey,
      orderBy: { createdAt: 'asc' },
      include: { question: true },
    });

    // Питомцы
    const pets = { dog: 0, cat: 0, both: 0, none: 0 };
    // Траты
    const spend: Record<string, number> = {
      '<2000': 0,
      '2000-5000': 0,
      '5000-10000': 0,
      '>10000': 0,
    };
    // Возраст
    const age: Record<string, number> = { '<18': 0, '18-30': 0, '30-50': 0, '50<': 0 };
    // Интерес к заботе
    const care = { yes: 0, no: 0 };
    // Проблемы (multi)
    const problems: Record<string, number> = {};

    for (const r of answers) {
      if (r.question.type === 'single') {
        switch (r.value) {
          case 'pets_dog':
            pets.dog++;
            break;
          case 'pets_cat':
            pets.cat++;
            break;
          case 'pets_both':
            pets.both++;
            break;
          case 'pets_none':
            pets.none++;
            break;

          case '<2000':
          case '2000-5000':
          case '5000-10000':
          case '>10000':
            spend[r.value] = (spend[r.value] ?? 0) + 1;
            break;

          case '<18':
          case '18-30':
          case '30-50':
          case '50<':
            age[r.value] = (age[r.value] ?? 0) + 1;
            break;

          case 'yes':
            care.yes++;
            break;
          case 'no':
            care.no++;
            break;
          default:
            // другие одиночные значения игнорим для этой сводки
            break;
        }
      } else if (r.question.type === 'multi') {
        try {
          const { selected } = JSON.parse(r.value) as { selected?: string[] };
          for (const v of selected ?? []) {
            problems[v] = (problems[v] ?? 0) + 1;
          }
        } catch {
          // если вдруг в мульти пришёл plain-text — пропустим
        }
      }
    }

    // Лиды: считаем либо в рамках surveyId, либо все
    const leads = await prisma.lead.count({
      where: surveyId ? { surveyId } : {},
    });

    return { scope: surveyId ? 'by-survey' : 'all-surveys', surveyId: surveyId ?? null, pets, spend, age, care, problems, leads };
  }

  // ====== Демо-сидер (без изменений) ======
  async seedFull() {
    const survey = await prisma.survey.create({ data: { title: 'Pet Survey' } });

    // Q1: питомец (single) — развилки
    const q1 = await prisma.question.create({
      data: { surveyId: survey.id, order: 1, type: 'single', text: 'У вас есть питомец?' },
    });

    // Q2: траты (категории single)
    const q2 = await prisma.question.create({
      data: { surveyId: survey.id, order: 2, type: 'single', text: 'Сколько денег вы тратите на питомца в месяц?' },
    });

    // Q3: возраст (single)
    const q3 = await prisma.question.create({
      data: { surveyId: survey.id, order: 3, type: 'single', text: 'Ваш возраст' },
    });

    // Q3b: интересно ли следить за здоровьем собаки? (single, да/нет)
    const q3b = await prisma.question.create({
      data: { surveyId: survey.id, order: 4, type: 'single', text: 'Интересно ли вам следить за здоровьем собаки?' },
    });

    // Q4: проблемы (multi)
    const q4 = await prisma.question.create({
      data: { surveyId: survey.id, order: 5, type: 'multi', text: 'С какими проблемами вы сталкивались?' },
    });

    await prisma.survey.update({ where: { id: survey.id }, data: { firstQuestionId: q1.id } });

    await prisma.option.createMany({
      data: [
        // Q1
        { questionId: q1.id, label: 'Собака', value: 'pets_dog', nextQuestionId: q2.id },
        { questionId: q1.id, label: 'Кошка', value: 'pets_cat', nextQuestionId: q2.id },
        { questionId: q1.id, label: 'И собака, и кошка', value: 'pets_both', nextQuestionId: q2.id },
        { questionId: q1.id, label: 'Нет', value: 'pets_none', nextQuestionId: null },
        // Q2
        { questionId: q2.id, label: 'до 2000', value: '<2000', nextQuestionId: q3.id },
        { questionId: q2.id, label: '2000–5000', value: '2000-5000', nextQuestionId: q3.id },
        { questionId: q2.id, label: '5000–10000', value: '5000-10000', nextQuestionId: q3.id },
        { questionId: q2.id, label: 'более 10000', value: '>10000', nextQuestionId: q3.id },
        // Q3
        { questionId: q3.id, label: '<18', value: '<18', nextQuestionId: q3b.id },
        { questionId: q3.id, label: '18–30', value: '18-30', nextQuestionId: q3b.id },
        { questionId: q3.id, label: '30–50', value: '30-50', nextQuestionId: q3b.id },
        { questionId: q3.id, label: '50<', value: '50<', nextQuestionId: q3b.id },
        // Q3b
        { questionId: q3b.id, label: 'Да', value: 'yes', nextQuestionId: q4.id },
        { questionId: q3b.id, label: 'Нет', value: 'no', nextQuestionId: q4.id },
        // Q4 (multi)
        { questionId: q4.id, label: 'Питомец убегал/терялся', value: 'lost' },
        { questionId: q4.id, label: 'Боюсь, что убежит', value: 'fear' },
        { questionId: q4.id, label: 'Тяжело найти в темноте', value: 'dark' },
        { questionId: q4.id, label: 'Не люблю подписки/тарифы', value: 'pricing' },
        { questionId: q4.id, label: 'Слабая батарея/сложно заряжать', value: 'battery' },
        { questionId: q4.id, label: 'Неудобный/тяжёлый ошейник', value: 'collar' },
        { questionId: q4.id, label: 'Приватность/безопасность', value: 'privacy' },
        { questionId: q4.id, label: 'Другое', value: 'other' },
      ],
    });

    return { surveyId: survey.id, firstQuestionId: q1.id };
  }

  // ====== Экспорты ALL (без изменений по сути) ======
  async exportAllCsv() {
    const rows = await prisma.answer.findMany({
      orderBy: { createdAt: 'desc' },
      include: { question: { include: { survey: true, options: true } } },
    });

    const leads = await prisma.lead.findMany();
    const leadByUser = new Map(leads.map((l) => [l.userId ?? '', l]));

    const header = [
      'createdAt',
      'surveyTitle',
      'userId',
      'question',
      'type',
      'value',
      'label',
      'lead_email',
      'lead_telegram',
    ];
    const lines = [header.join(',')];

    const csv = (s: string) =>
      s && (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? `"${s.replace(/"/g, '""')}"`
        : s ?? '';

    for (const r of rows) {
      const opt = r.question.options?.find((o) => o.value === r.value);
      const lead = leadByUser.get(r.userId ?? '');
      lines.push(
        [
          r.createdAt.toISOString(),
          csv(r.question.survey?.title ?? ''),
          csv(r.userId ?? ''),
          csv(r.question.text),
          r.question.type,
          csv(r.value),
          csv(opt?.label ?? ''),
          csv(lead?.email ?? ''),
          csv(lead?.telegram ?? ''),
        ].join(','),
      );
    }
    return lines.join('\n');
  }

  async exportAllWideCsv() {
    const questions = await prisma.question.findMany({
      orderBy: [{ surveyId: 'asc' }, { order: 'asc' }],
      include: { survey: true, options: true },
    });
    const answers = await prisma.answer.findMany({
      orderBy: { createdAt: 'asc' },
      include: { question: { include: { survey: true, options: true } } },
    });
    const leads = await prisma.lead.findMany();
    const leadByUser = new Map(leads.map((l) => [l.userId ?? '', l]));

    const qHeaders = questions.map(
      (q) => `${q.survey?.title ?? 'Survey'}: ${q.text}`,
    );
    const header = ['userId', ...qHeaders, 'contact_email', 'contact_telegram'];

    const csv = (s: string) =>
      s && (s.includes(',') || s.includes('"') || s.includes('\n'))
        ? `"${s.replace(/"/g, '""')}"`
        : s ?? '';
    const lines = [header.map(csv).join(',')];

    const byUser = new Map<string, typeof answers>();
    for (const a of answers) {
      const key = a.userId ?? '(anonymous)';
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key)!.push(a);
    }

    for (const [userId, list] of byUser) {
      const dict = new Map<string, string>();
      for (const r of list) {
        if (r.question.type === 'single') {
          const opt = r.question.options.find((o) => o.value === r.value);
          dict.set(r.question.id, opt?.label ?? r.value);
        } else if (r.question.type === 'multi') {
          try {
            const parsed = JSON.parse(r.value) as { selected?: string[]; other?: string };
            const labels = (parsed.selected ?? []).map(
              (v) => r.question.options.find((o) => o.value === v)?.label ?? v,
            );
            const combined = [...labels, parsed.other ?? ''].filter(Boolean).join(' | ');
            dict.set(r.question.id, combined);
          } catch {
            dict.set(r.question.id, r.value);
          }
        } else {
          dict.set(r.question.id, r.value);
        }
      }
      const lead = leadByUser.get(userId === '(anonymous)' ? '' : userId);
      const row = [
        csv(userId),
        ...questions.map((q) => csv(dict.get(q.id) ?? '')),
        csv(lead?.email ?? ''),
        csv(lead?.telegram ?? ''),
      ];
      lines.push(row.join(','));
    }
    return lines.join('\n');
  }
}
