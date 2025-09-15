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

function getUserId(): string {
  if (typeof window === "undefined") return "";
  const KEY = "survey_user_id"; // единый ключ
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** ===== Компоненты UI ===== */
function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden" aria-label="Прогресс">
      <div className="h-full bg-blue-600" style={{ width: `${pct}%` }} />
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
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-md border hover:bg-slate-50"
              aria-label="Закрыть"
            >
              Закрыть
            </button>
          </div>
          <div className="p-6 text-sm text-slate-700 leading-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** ===== Главная страница-движок опроса ===== */
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

  // Прогресс: считаем по истории + текущий вопрос
  const progress = useMemo(() => {
    if (finished) return 100;
    const steps = history.length + (question ? 1 : 0);
    const max = 5; // ваш текущий сценарий
    return Math.min(100, Math.round((steps / max) * 100));
  }, [history, question, finished]);

  // init
  useEffect(() => {
    setUserId(getUserId());
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
    <p className="text-xs text-slate-500">
      Нажимая «Далее», вы соглашаетесь с{" "}
      <button className="underline underline-offset-2" onClick={() => setPrivacyOpen(true)}>
        политикой приватности
      </button>
      .
    </p>
  );

  async function handleSingleSubmit(value: string) {
    if (!question) return;
    const body = { userId, questionId: question.id, value };
    const res = await fetch(`${API}/survey/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-6 md:p-10">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Опрос</h1>
          <p className="text-slate-600 mt-1">Ответьте на несколько вопросов — это займёт 1–2 минуты.</p>
        </header>

        <div className="mb-6">
          <ProgressBar value={progress} />
          <div className="mt-2 text-xs text-slate-500">Прогресс: {progress}%</div>
        </div>

        {/* Основной блок */}
        <div className="rounded-2xl bg-white shadow p-6 md:p-8">
          {loading && <div>Загрузка…</div>}

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
              surveyId={surveyId}
            />
          )}
        </div>
      </div>

      {/* Модалка приватности */}
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

/** ===== Рендер одного вопроса с типами ===== */
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
      <p className="text-slate-600">Неподдерживаемый тип вопроса: {question.type}</p>
    </div>
  );
}

/** ===== Тип: single ===== */
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
      <div className="text-lg font-semibold mb-4">{title}</div>
      <div className="grid gap-2 mb-4">
        {options.map((o) => (
          <label
            key={o.id}
            className={cn(
              "flex items-center justify-between border rounded-xl px-4 py-3 cursor-pointer hover:bg-slate-50",
              value === o.value && "border-blue-600 bg-blue-50"
            )}
          >
            <span className="text-sm">{o.label}</span>
            <input
              type="radio"
              name="single"
              className="ml-4"
              checked={value === o.value}
              onChange={() => setValue(o.value)}
            />
          </label>
        ))}
      </div>
      <button
        onClick={() => onSubmit(value)}
        className="w-full md:w-auto px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
        disabled={!value}
      >
        Далее
      </button>
      <div className="mt-3">{footer}</div>
    </div>
  );
}

/** ===== Тип: multi ===== */
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
      <div className="text-lg font-semibold mb-4">{title}</div>
      <div className="grid gap-2 mb-4">
        {options.map((o) => (
          <label
            key={o.id}
            className={cn(
              "flex items-center justify-between border rounded-xl px-4 py-3 cursor-pointer hover:bg-slate-50",
              selected.includes(o.value) && "border-blue-600 bg-blue-50"
            )}
          >
            <span className="text-sm">{o.label}</span>
            <input
              type="checkbox"
              className="ml-4"
              checked={selected.includes(o.value)}
              onChange={() => toggle(o.value)}
            />
          </label>
        ))}
      </div>

      {hasOther && (
        <div className="mb-4">
          <label className="block text-sm text-slate-700 mb-1">Другое</label>
          <input
            type="text"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            className="w-full border rounded-xl px-3 py-2"
            placeholder="Укажите свой вариант"
          />
        </div>
      )}

      <button
        onClick={() => onSubmit(selected, other.trim() || undefined)}
        className="w-full md:w-auto px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
        disabled={!selected.length && !other.trim()}
      >
        Далее
      </button>
      <div className="mt-3">{footer}</div>
    </div>
  );
}

/** ===== Тип: text ===== */
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
      <div className="text-lg font-semibold mb-4">{title}</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="w-full border rounded-xl px-3 py-2 mb-4"
        placeholder="Введите ответ"
      />
      <button
        onClick={() => onSubmit(text)}
        className="w-full md:w-auto px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
        disabled={!text.trim()}
      >
        Далее
      </button>
      <div className="mt-3">{footer}</div>
    </div>
  );
}

/** ===== Финальный экран (CTA) ===== */
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
  surveyId, // оставлен на будущее, сейчас не используем для кнопок
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
  surveyId: string | null;
}) {
  const needLead = preorder || partner;

  return (
    <div>
      <div className="text-lg font-semibold mb-4">Спасибо! Ваши ответы сохранены.</div>
      <p className="text-slate-600 mb-4">
        Если хотите оформить предзаказ или обсудить сотрудничество — выберите варианты ниже.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <button
          className={cn("border rounded-xl px-4 py-3 text-left hover:bg-slate-50", preorder && "border-blue-600 bg-blue-50")}
          onClick={() => setPreorder(!preorder)}
        >
          <div className="font-semibold">Предзаказ</div>
          <div className="text-sm text-slate-600">Получить доступ к эксклюзивным предложениям на релизе</div>
        </button>

        <button
          className={cn("border rounded-xl px-4 py-3 text-left hover:bg-slate-50", partner && "border-blue-600 bg-blue-50")}
          onClick={() => setPartner(!partner)}
        >
          <div className="font-semibold">Сотрудничество</div>
          <div className="text-sm text-slate-600">Связаться по партнёрству/дистрибуции</div>
        </button>
      </div>

      {needLead && (
        <div className="mb-4">
          <div className="grid gap-3">
            <div>
              <label className="block text-sm text-slate-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-700 mb-1">Telegram (необязательно)</label>
              <input
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="@username"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onSubmit} className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700">
          Завершить
        </button>

        {/* ТОЛЬКО ГЛОБАЛЬНЫЕ ВЫГРУЗКИ */}
        <a href={`${API}/survey/export-all.csv`} className="px-5 py-3 rounded-xl border hover:bg-slate-50 text-center">
          Все ответы (все опросы)
        </a>
        <a
          href={`${API}/survey/export-all-wide.csv`}
          className="px-5 py-3 rounded-xl border hover:bg-slate-50 text-center"
        >
          Все опросы по пользователям
        </a>
      </div>
    </div>
  );
}
