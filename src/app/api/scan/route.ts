// POST /api/scan — scan arbitrary text for sensitive findings.
// Body: { text, location?, sourceTool? }
// Returns: { findings: Finding[] }

import { NextRequest, NextResponse } from "next/server";
import { scanFindings } from "@/lib/findings";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "");
  if (!text) return NextResponse.json({ findings: [] });
  const findings = scanFindings(text, { location: body.location || "", sourceTool: body.sourceTool || "manual" });
  return NextResponse.json({ findings });
}
