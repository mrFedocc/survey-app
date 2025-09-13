"use client";
import { useState } from "react";

const QUESTION_ID = "cmfissn220002orxrr8x6ve9i";

export default function Home() {
  const [started, setStarted] = useState(false);
  const [value, setValue] = useState("");

  async function submit() {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/survey/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: QUESTION_ID, value }),
    });
    alert("Ответ сохранён!");
  }

  if (!started) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-xl w-full rounded-2xl bg-white shadow-lg p-8">
          <span className="text-sm text-blue-500 font-medium">Beta</span>
          <h1 className="text-3xl font-bold mt-2">Опрос пользователей</h1>
          <p className="text-slate-600 mt-2">
            Ваше мнение помогает нам сделать продукт лучше.
          </p>
          <button
            onClick={() => setStarted(true)}
            className="mt-6 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Начать опрос
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-xl w-full rounded-2xl bg-white shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-4">Насколько вероятно, что вы нас порекомендуете?</h2>
        <input
          type="number"
          min="0"
          max="10"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full border p-2 rounded mb-4"
        />
        <button
          onClick={submit}
          className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700"
        >
          Отправить ответ
        </button>
      </div>
    </main>
  );
}
await fetch(`${process.env.NEXT_PUBLIC_API_URL}/survey/answer`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ questionId: QUESTION_ID, value: "10" }),
});
