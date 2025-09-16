import { NextRequest, NextResponse } from "next/server";

const API = process.env.NEXT_PUBLIC_API_URL!;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN!; // server-side env (НЕ NEXT_PUBLIC)

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file") ?? "all";
  const map: Record<string,string> = {
    csv: "/survey/export.csv",
    wide: "/survey/export-wide.csv",
    all: "/survey/export-all.csv",
    "all-wide": "/survey/export-all-wide.csv",
  };
  const path = map[file] ?? map.all;

  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    // никаких client cookies/credentials
  });

  if (!r.ok) {
    const text = await r.text();
    return new NextResponse(text, { status: r.status });
  }

  const csv = await r.text();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}.csv"`,
    },
  });
}
