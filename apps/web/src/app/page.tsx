"use client";

import { useEffect, useMemo, useState } from "react";

/** ===== Типы данных API ===== */
type Option = {
  id: string;
  label: string;
  value: string;
  nextQuestionId?: string | null;
};

type Question = {
  id: string;
  surveyId: string;
  order: number;
  type: "single" | "multi" | "text" | string;
  text: string;
  options?: Option[];
};

type StartRes = { surveyId: string | null; questionId: string | null };

const API = process.env.NEXT_PUBLIC_API_URL;

/** ===== Утилиты ===== */
function assertApi() {
  if (!API) throw new Error("NEXT_PUBLIC_API_URL не задан. Проверь apps/web/.env.local");
}

/** Базовый постоянный ID + одноразовый runId для каждого прогона */
function getRunUserId(): string {
  if (typeof window === "undefined") return "";
  const BASE_KEY = "survey_base_user_id";
  const RUN_KEY = "survey_run_id";
  let base = localStorage.getItem(BASE_KEY);
  if (!base) {
    base = crypto.randomUUID();
    localStorage.setItem(BASE_KEY, base);
  }
  let run = sessionStorage.getItem(RUN_KEY);
  if (!run) {
    run = `${crypto.randomUUID()}:${Date.now()}`;
    sessionStorage.setItem(RUN_KEY, run);
  }
  return `${base}::${run}`;
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** ===== Визуальные элементы под стиль Petly ===== */
function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full h-2 rounded-full overflow-hidden bg-white/10">
      <div
        className="h-full bg-brand-500 shadow-[0_0_12px_rgba(236,72,153,0.6)] transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl bg-white/10 border border-white/10 backdrop-blur-xl shadow-glow">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-md border border-white/15 text-white/90 hover:bg-white/10"
              aria-label="Закрыть"
            >
              Закрыть
            </button>
          </div>
          <div className="p-6 text-sm text-white/80 leading-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** ===== Главная страница-движок опроса (тёмная, стекло, розовый бренд) ===== */
export default function SurveyPage() {
  assertApi();
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const [surveyId, setSurveyId] = useState<string | null>(null);

  // CTA (финальный экран)
  const [preorder, setPreorder] = useState(false);
  const [partner, setPartner] = useState(false);
  const [email, setEmail] = useState("");
  const [telegram, setTelegram] = useState("");
  const needLead = preorder || partner;

  // Прогресс
  const progress = useMemo(() => {
    if (finished) return 100;
    const steps = history.length + (question ? 1 : 0);
    const max = 5;
    return Math.min(100, Math.round((steps / max) * 100));
  }, [history, question, finished]);

  // init
  useEffect(() => {
    setUserId(getRunUserId());
    (async () => {
      try {
        const s: StartRes = await fetch(`${API}/survey/start`).then((r) => r.json());
        setSurveyId(s.surveyId);
        setCurrentId(s.questionId);
      } catch (e) {
        console.error(e);
        alert("Не удалось начать опрос. Попробуйте позже.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // загрузка вопроса
  useEffect(() => {
    if (!currentId) return;
    (async () => {
      try {
        const q: Question = await fetch(`${API}/survey/question/${currentId}`, {
          cache: "no-store",
        }).then((r) => r.json());
        setQuestion(q);
      } catch (e) {
        console.error(e);
        alert("Не удалось загрузить вопрос.");
      }
    })();
  }, [currentId]);

  const PrivacyNote = () => (
    <p className="text-xs text-white/60">
      Нажимая «Далее», вы соглашаетесь с{" "}
      <button className="text-brand-400 underline underline-offset-2 hover:text-brand-300" onClick={() => setPrivacyOpen(true)}>
        политикой приватности
      </button>
      .
    </p>
  );

  async function handleSingleSubmit(value: string) {
    if (!question) return;
    const res = await fetch(`${API}/survey/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, questionId: question.id, value }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("answer failed", res.status, t);
      alert("Ошибка отправки ответа.");
      return;
    }
    const data = await res.json();
    setHistory((h) => [...h, question.id]);
    if (data.nextQuestionId) setCurrentId(data.nextQuestionId);
    else {
      setQuestion(null);
      setFinished(true);
    }
  }

  async function handleMultiSubmit(selected: string[], otherText?: string) {
    if (!question) return;
    if (!selected.length && !otherText) {
      alert("Выберите хотя бы один вариант или заполните «Другое»");
      return;
    }
    const payload = { selected, ...(otherText ? { other: otherText } : {}) };
    const res = await fetch(`${API}/survey/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, questionId: question.id, value: JSON.stringify(payload) }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("answer failed", res.status, t);
      alert("Ошибка отправки ответа.");
      return;
    }
    const data = await res.json();
    setHistory((h) => [...h, question.id]);
    if (data.nextQuestionId) setCurrentId(data.nextQuestionId);
    else {
      setQuestion(null);
      setFinished(true);
    }
  }

  async function handleTextSubmit(text: string) {
    if (!question) return;
    if (!text.trim()) {
      alert("Пожалуйста, заполните поле");
      return;
    }
    const res = await fetch(`${API}/survey/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, questionId: question.id, value: text.trim() }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("answer failed", res.status, t);
      alert("Ошибка отправки ответа.");
      return;
    }
    const data = await res.json();
    setHistory((h) => [...h, question.id]);
    if (data.nextQuestionId) setCurrentId(data.nextQuestionId);
    else {
      setQuestion(null);
      setFinished(true);
    }
  }

  async function submitLead() {
    if (!needLead) {
      alert("Спасибо! Ваши ответы сохранены.");
      return;
    }
    if (!email.trim()) {
      alert("Укажите email, чтобы мы могли связаться");
      return;
    }
    const res = await fetch(`${API}/survey/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        surveyId,
        choices: { preorder, partner },
        email: email.trim(),
        telegram: telegram.trim() || undefined,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("lead failed", res.status, t);
      alert("Ошибка отправки анкеты.");
      return;
    }
    alert("Спасибо! Мы свяжемся с вами.");
  }

  return (
    <main className="min-h-screen bg-hero-gradient">
      {/* Hero-заголовок как на лендинге */}
      <header className="section pt-10 pb-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Опрос Petly
          </h1>
          <p className="mt-3 text-white/70">
            Ответьте на несколько вопросов — это займёт 1–2 минуты.
          </p>
        </div>
      </header>

      {/* Прогресс */}
      <div className="section">
        <div className="mx-auto max-w-2xl">
          <ProgressBar value={progress} />
          <div className="mt-2 text-xs text-white/60">Прогресс: {progress}%</div>
        </div>
      </div>

      {/* Карточка опроса в стиле стекла */}
      <section className="section py-8 md:py-10">
        <div className="mx-auto w-full max-w-2xl glass p-6 md:p-8 shadow-glow">
          {loading && <div className="text-white/80">Загрузка…</div>}

          {!loading && !finished && question && (
            <QuestionBlock
              question={question}
              onSubmitSingle={handleSingleSubmit}
              onSubmitMulti={handleMultiSubmit}
              onSubmitText={handleTextSubmit}
              footer={<PrivacyNote />}
            />
          )}

          {!loading && (finished || (!question && !currentId)) && (
            <FinalBlock
              preorder={preorder}
              partner={partner}
              setPreorder={setPreorder}
              setPartner={setPartner}
              email={email}
              setEmail={setEmail}
              telegram={telegram}
              setTelegram={setTelegram}
              onSubmit={submitLead}
            />
          )}
        </div>
      </section>

      {/* Политика приватности */}
      <Modal open={privacyOpen} onClose={() => setPrivacyOpen(false)} title="Политика приватности">
        <p>
          Мы собираем ваши ответы исключительно для аналитики продукта. Контакты (email/telegram), если вы их
          оставляете, используются только для обратной связи по предзаказу или сотрудничеству. Данные не передаются
          третьим лицам.
        </p>
        <p className="mt-3">Отправляя ответы, вы соглашаетесь с указанными условиями обработки данных.</p>
      </Modal>
    </main>
  );
}

/** ===== Рендер вопроса ===== */
function QuestionBlock({
  question,
  onSubmitSingle,
  onSubmitMulti,
  onSubmitText,
  footer,
}: {
  question: Question;
  onSubmitSingle: (value: string) => Promise<void>;
  onSubmitMulti: (values: string[], other?: string) => Promise<void>;
  onSubmitText: (text: string) => Promise<void>;
  footer?: React.ReactNode;
}) {
  if (question.type === "single") {
    return (
      <SingleQuestion title={question.text} options={question.options ?? []} onSubmit={onSubmitSingle} footer={footer} />
    );
  }
  if (question.type === "multi") {
    return (
      <MultiQuestion title={question.text} options={question.options ?? []} onSubmit={onSubmitMulti} footer={footer} />
    );
  }
  if (question.type === "text") {
    return <TextQuestion title={question.text} onSubmit={onSubmitText} footer={footer} />;
  }
  return (
    <div>
      <div className="text-lg font-semibold mb-4">{question.text}</div>
      <p className="text-white/70">Неподдерживаемый тип вопроса: {question.type}</p>
    </div>
  );
}

/** ===== Single ===== */
function SingleQuestion({
  title,
  options,
  onSubmit,
  footer,
}: {
  title: string;
  options: Option[];
  onSubmit: (value: string) => Promise<void>;
  footer?: React.ReactNode;
}) {
  const [value, setValue] = useState<string>("");

  return (
    <div>
      <div className="text-xl md:text-2xl font-semibold mb-5">{title}</div>
      <div className="grid gap-2 mb-5">
        {options.map((o) => (
          <label
            key={o.id}
            className={cn(
              "flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer border border-white/10 bg-white/5 hover:bg-white/10 transition",
              value === o.value && "border-brand-500 ring-1 ring-brand-500/40 bg-white/10"
            )}
          >
            <span className="text-sm text-white/90">{o.label}</span>
            <input
              type="radio"
              name="single"
              className="ml-4 accent-brand-500"
              checked={value === o.value}
              onChange={() => setValue(o.value)}
            />
          </label>
        ))}
      </div>
      <button
        onClick={() => onSubmit(value)}
        className="w-full md:w-auto px-5 py-3 rounded-xl bg-brand-500 text-white font-semibold shadow-glow hover:bg-brand-600 active:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        disabled={!value}
      >
        Далее
      </button>
      <div className="mt-3">{footer}</div>
    </div>
  );
}

/** ===== Multi ===== */
function MultiQuestion({
  title,
  options,
  onSubmit,
  footer,
}: {
  title: string;
  options: Option[];
  onSubmit: (values: string[], other?: string) => Promise<void>;
  footer?: React.ReactNode;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState<string>("");

  const hasOther = options.some((o) => o.value === "other");

  function toggle(val: string) {
    setSelected((arr) => (arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]));
  }

  return (
    <div>
      <div className="text-xl md:text-2xl font-semibold mb-5">{title}</div>
      <div className="grid gap-2 mb-5">
        {options.map((o) => (
          <label
            key={o.id}
            className={cn(
              "flex items-center justify-between rounded-xl px-4 py-3 cursor-pointer border border-white/10 bg-white/5 hover:bg-white/10 transition",
              selected.includes(o.value) && "border-brand-500 ring-1 ring-brand-500/40 bg-white/10"
            )}
          >
            <span className="text-sm text-white/90">{o.label}</span>
            <input
              type="checkbox"
              className="ml-4 accent-brand-500"
              checked={selected.includes(o.value)}
              onChange={() => toggle(o.value)}
            />
          </label>
        ))}
      </div>

      {hasOther && (
        <div className="mb-5">
          <label className="block text-sm text-white/80 mb-1">Другое</label>
          <input
            type="text"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            className="w-full rounded-xl px-3 py-2 bg-white/5 border border-white/10 placeholder-white/40 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            placeholder="Укажите свой вариант"
          />
        </div>
      )}

      <button
        onClick={() => onSubmit(selected, other.trim() || undefined)}
        className="w-full md:w-auto px-5 py-3 rounded-xl bg-brand-500 text-white font-semibold shadow-glow hover:bg-brand-600 active:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        disabled={!selected.length && !other.trim()}
      >
        Далее
      </button>
      <div className="mt-3">{footer}</div>
    </div>
  );
}

/** ===== Text ===== */
function TextQuestion({
  title,
  onSubmit,
  footer,
}: {
  title: string;
  onSubmit: (text: string) => Promise<void>;
  footer?: React.ReactNode;
}) {
  const [text, setText] = useState("");
  return (
    <div>
      <div className="text-xl md:text-2xl font-semibold mb-5">{title}</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="w-full rounded-xl px-3 py-2 mb-5 bg-white/5 border border-white/10 placeholder-white/40 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
        placeholder="Введите ответ"
      />
      <button
        onClick={() => onSubmit(text)}
        className="w-full md:w-auto px-5 py-3 rounded-xl bg-brand-500 text-white font-semibold shadow-glow hover:bg-brand-600 active:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        disabled={!text.trim()}
      >
        Далее
      </button>
      <div className="mt-3">{footer}</div>
    </div>
  );
}

/** ===== Финал/CTA в стиле лендинга ===== */
function FinalBlock({
  preorder,
  partner,
  setPreorder,
  setPartner,
  email,
  setEmail,
  telegram,
  setTelegram,
  onSubmit,
}: {
  preorder: boolean;
  partner: boolean;
  setPreorder: (v: boolean) => void;
  setPartner: (v: boolean) => void;
  email: string;
  setEmail: (s: string) => void;
  telegram: string;
  setTelegram: (s: string) => void;
  onSubmit: () => Promise<void>;
}) {
  const needLead = preorder || partner;

  return (
    <div>
      <div className="text-xl md:text-2xl font-semibold mb-3">Спасибо! Ваши ответы сохранены.</div>
      <p className="text-white/70 mb-4">
        Если хотите оформить предзаказ или обсудить сотрудничество — выберите варианты ниже.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <button
          className={cn(
            "border border-white/10 rounded-xl px-4 py-3 text-left bg-white/5 hover:bg-white/10 transition",
            preorder && "border-brand-500 ring-1 ring-brand-500/40"
          )}
          onClick={() => setPreorder(!preorder)}
        >
          <div className="font-semibold">Предзаказ</div>
          <div className="text-sm text-white/70">Получить доступ к эксклюзивным предложениям на релизе</div>
        </button>

        <button
          className={cn(
            "border border-white/10 rounded-xl px-4 py-3 text-left bg-white/5 hover:bg-white/10 transition",
            partner && "border-brand-500 ring-1 ring-brand-500/40"
          )}
          onClick={() => setPartner(!partner)}
        >
          <div className="font-semibold">Сотрудничество</div>
          <div className="text-sm text-white/70">Связаться по партнёрству/дистрибуции</div>
        </button>
      </div>

      {needLead && (
        <div className="mb-5">
          <div className="grid gap-3">
            <div>
              <label className="block text-sm text-white/80 mb-1">
                Email <span className="text-brand-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl px-3 py-2 bg-white/5 border border-white/10 placeholder-white/40 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80 mb-1">Telegram (необязательно)</label>
              <input
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                className="w-full rounded-xl px-3 py-2 bg-white/5 border border-white/10 placeholder-white/40 text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                placeholder="@username"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onSubmit}
          className="px-5 py-3 rounded-xl bg-brand-500 text-white font-semibold shadow-glow hover:bg-brand-600 active:bg-brand-700 transition"
        >
          Завершить
        </button>
        {/* Глобальные выгрузки оставляем как у тебя на бэке */}
        <a
          href={`${API}/survey/export-all.csv`}
          className="px-5 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-center"
        >
          Все ответы (все опросы)
        </a>
        <a
          href={`${API}/survey/export-all-wide.csv`}
          className="px-5 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-center"
        >
          Все опросы по пользователям
        </a>
      </div>
    </div>
  );
}
