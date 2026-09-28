// GET /api/settings  — current settings
// PUT /api/settings  — patch { provider?, model?, theme?, targetScope?, runtime?: {...} }

import { NextRequest, NextResponse } from "next/server";
import { loadSettings, saveSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await loadSettings());
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const updated = await saveSettings(body);
  return NextResponse.json(updated);
}
