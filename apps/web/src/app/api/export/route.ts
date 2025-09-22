import { NextRequest, NextResponse } from "next/server";

const API = process.env.NEXT_PUBLIC_API_URL!;
const ADMIN = process.env.ADMIN_TOKEN!; // секрет из Vercel

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file") ?? "export";
  const url = `${API}/survey/${file}.csv`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ADMIN}` },
    // при желании: cache: "no-store"
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: text || res.statusText }, { status: res.status });
  }

  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}.csv"`,
    },
  });
}