// apps/web/app/admin/export/route.ts
// Делает хендлер статическим, чтобы он не валил билд при output: 'export'
export const dynamic = 'force-static';
export const revalidate = 60; // можно 300/600 — главное, не 0

import { NextResponse } from 'next/server';

export async function GET() {
  // НИКАКИХ внешних запросов/секретов — всё должно рассчитываться на билде
  const payload = await getExportData();

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${revalidate}, s-maxage=${revalidate}`,
    },
  });
}

// Заглушка статических данных — подставь, если нужно, свои build-time данные
async function getExportData() {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    items: [] as unknown[],
  };
}
