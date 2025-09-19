import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { GoogleSheetsService } from './google-sheets.service';

const sheets = new GoogleSheetsService();

// IDs твоих таблиц
const SHEET_PER_ANSWER = '1ZqF_Wf6Pb89BIxnNbGpZiExgdLfpJ2NRyT8P2ueTLNQ';
const SHEET_WIDE       = '1IpYF1_62Sc1Oz6i-QVA12qs3BUGLLwJm4IIFdh0Uwt8';

const prisma = new PrismaClient();
const leadKey = (surveyId?: string | null, userId?: string | null) =>
  `${surveyId ?? ''}::${userId ?? ''}`;

type MultiPayload = { selected: string[]; other?: string };

@Injectable()
export class SurveyService {
  async start(surveyId?: string) {
  const survey = await this.getActiveSurvey(surveyId); // уже есть в классе
  const withQs = await prisma.survey.findUnique({
    where: { id: survey.id },
    include: { questions: true },
  });
  if (!withQs) return { surveyId: null, questionId: null };

  const first =
    withQs.firstQuestionId ??
    withQs.questions.sort((a, b) => a.order - b.order)[0]?.id ??
    null;

  return { surveyId: withQs.id, questionId: first };
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

    // Сохраняем ответ и получаем createdAt
const saved = await prisma.answer.create({ data: dto });

// Готовим строку для per-answer таблицы
let answerLabel = '';
let multiSelected = '';
let multiLabels = '';
let multiOther = '';

if (q.type === 'single') {
  const opt = q.options.find(o => o.value === dto.value);
  answerLabel = opt?.label ?? '';
} else if (q.type === 'multi') {
  try {
    const parsed = JSON.parse(dto.value) as { selected?: string[]; other?: string };
    const sel = parsed.selected ?? [];
    multiSelected = sel.join('|');
    multiLabels = sel
      .map(v => q.options.find(o => o.value === v)?.label ?? v)
      .join('|');
    multiOther = parsed.other ?? '';
  } catch {/* ignore */}
}

// userId может быть undefined — нормализуем
const userIdNorm = dto.userId ?? '';

// Добавляем строку в Google Sheets (per-answer)
try {
  await sheets.appendRow(SHEET_PER_ANSWER, [
    saved.createdAt.toISOString(), // createdAt
    q.surveyId,                    // surveyId
    userIdNorm,                    // userId
    q.text,                        // question
    q.type,                        // type
    dto.value,                     // answer_value (raw)
    answerLabel,                   // answer_label (для single)
    multiSelected,                 // multi_selected
    multiLabels,                   // multi_labels
    multiOther                     // multi_other
  ]);
} catch (e) {
  // Не роняем опрос из-за сетевых проблем — просто лог
  console.error('Sheets append error:', e);
}


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
      '20.000-25.000': 0,
      '25.000-30.000': 0,
      '30.000-40.000': 0,
      '40.000+': 0,
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

          
          case '20.000-25.000':
          case '25.000-30.000':
          case '30.000-40.000':
          case '40.000+':
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

  // ====== Демо-сидер (нужный порядок) ======
async seedFull() {
  const survey = await prisma.survey.create({
    data: { title: 'Petly — опрос' },
  });

  // Q1: питомец (single) — ПЕРВЫЙ
  const qPet = await prisma.question.create({
    data: { surveyId: survey.id, order: 1, type: 'single', text: 'У вас есть питомец?' },
  });

  // Q2: траты (single)
  const qSpend = await prisma.question.create({
    data: { surveyId: survey.id, order: 2, type: 'single', text: 'Сколько денег Вы готовы выделить на наш ошейник?' },
  });

  // Q3: возраст (single)
  const qAge = await prisma.question.create({
    data: { surveyId: survey.id, order: 3, type: 'single', text: 'Ваш возраст' },
  });

  // Q4: интерес к заботе (single)
  const qCare = await prisma.question.create({
    data: { surveyId: survey.id, order: 4, type: 'single', text: 'Интересно ли вам следить за здоровьем собаки?' },
  });

  // Q5: проблемы (multi) — последний
  const qProblems = await prisma.question.create({
    data: { surveyId: survey.id, order: 5, type: 'multi', text: 'Что было бы для Вас важным?' },
  });

  // Стартуем с Q1 (питомец)
  await prisma.survey.update({
    where: { id: survey.id },
    data: { firstQuestionId: qPet.id },
  });

  // Опции
  await prisma.option.createMany({
    data: [
      // Q1 -> Q2
      { questionId: qPet.id, label: 'Собака', value: 'pets_dog', nextQuestionId: qSpend.id },
      { questionId: qPet.id, label: 'Кошка', value: 'pets_cat', nextQuestionId: qSpend.id },
      { questionId: qPet.id, label: 'И собака, и кошка', value: 'pets_both', nextQuestionId: qSpend.id },
      { questionId: qPet.id, label: 'Нет', value: 'pets_none', nextQuestionId: qSpend.id },

      // Q2 (траты) -> Q3
      { questionId: qSpend.id, label: '20.000–25.000', value: '20.000-25.000', nextQuestionId: qAge.id },
      { questionId: qSpend.id, label: '25.000–30.000', value: '25.000-30.000', nextQuestionId: qAge.id },
      { questionId: qSpend.id, label: '30.000–40.000', value: '30.000-40.000', nextQuestionId: qAge.id },
      { questionId: qSpend.id, label: '40.000+',       value: '40.000+',       nextQuestionId: qAge.id },

      // Q3 (возраст) -> Q4
      { questionId: qAge.id, label: '<18',   value: '<18',   nextQuestionId: qCare.id },
      { questionId: qAge.id, label: '18–30', value: '18-30', nextQuestionId: qCare.id },
      { questionId: qAge.id, label: '30–50', value: '30-50', nextQuestionId: qCare.id },
      { questionId: qAge.id, label: '50<',   value: '50<',   nextQuestionId: qCare.id },

      // Q4 (интерес к заботе) -> Q5
      { questionId: qCare.id, label: 'Да',  value: 'yes', nextQuestionId: qProblems.id },
      { questionId: qCare.id, label: 'Нет', value: 'no',  nextQuestionId: qProblems.id },

      // Q5 (multi) — без nextQuestionId
      { questionId: qProblems.id, label: 'Отслеживание питомца на карте',      value: 'track' },
    { questionId: qProblems.id, label: 'Фонарик и звуковой сигнал в ошейнике', value: 'flashlight_beeper' },
    { questionId: qProblems.id, label: 'Состояние здоровья питомца',         value: 'health' },
    { questionId: qProblems.id, label: 'Онлайн камера прямо на ошейнике',    value: 'camera' },
    { questionId: qProblems.id, label: 'Комфортный вес ошейника',            value: 'weight' },
    { questionId: qProblems.id, label: 'Недорогие тарифы подписки',          value: 'pricing' },
    { questionId: qProblems.id, label: 'Анализ активности питомца',          value: 'activity' },
    { questionId: qProblems.id, label: 'Ничего из вышеперечисленного',       value: 'none' },  // эксклюзивная
    { questionId: qProblems.id, label: 'Другое',                              value: 'other' }, // покажет инпут
    ],
  });

  return { surveyId: survey.id, firstQuestionId: qPet.id };
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

  /** Обновить wide-таблицу в Google Sheets (полной перезаписью) */
async syncWideToSheets(surveyId?: string) {
  // --- возьмем логику из exportWideCsv, но отдадим как матрицу значений ---
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
  const leadByKey = new Map(leads.map(l => [`${l.surveyId ?? ''}::${l.userId ?? ''}`, l]));

  const byUser = new Map<string, typeof answers>();
  for (const a of answers) {
    const key = a.userId ?? '(anonymous)';
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key)!.push(a);
  }

  const header = [
    'userId',
    ...questions.map(q => q.text),
    'contact_email',
    'contact_telegram',
    'choice_preorder',
    'choice_partner',
  ];
  const table: any[][] = [header];

  for (const [uid, list] of byUser) {
    const dict = new Map<string, string>();
    for (const r of list) {
      if (r.question.type === 'single') {
        const opt = r.question.options.find(o => o.value === r.value);
        dict.set(r.questionId, opt?.label ?? r.value);
      } else if (r.question.type === 'multi') {
        try {
          const parsed = JSON.parse(r.value) as { selected?: string[]; other?: string };
          const labels = (parsed.selected ?? []).map(
            v => r.question.options.find(o => o.value === v)?.label ?? v
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

    let email = '', telegram = '', preorder = '', partner = '';
    const lead = leadByKey.get(`${active.id}::${uid === '(anonymous)' ? '' : uid}`);
    if (lead) {
      email = lead.email ?? '';
      telegram = lead.telegram ?? '';
      try {
        const c = JSON.parse(lead.choices ?? '{}') as { preorder?: boolean; partner?: boolean };
        preorder = c.preorder ? '1' : '0';
        partner = c.partner ? '1' : '0';
      } catch {}
    }

    table.push([
      uid,
      ...questions.map(q => dict.get(q.id) ?? ''),
      email,
      telegram,
      preorder,
      partner,
    ]);
  }

  // перезаписываем wide-таблицу
  await sheets.updateTable(SHEET_WIDE, table);
}

}
