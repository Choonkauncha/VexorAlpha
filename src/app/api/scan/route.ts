// POST /api/scan — scan arbitrary text for sensitive findings.

import { NextRequest, NextResponse } from "next/server";
import { scanFindings } from "@/lib/findings";
import { isSessionUser, requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!isSessionUser(user)) return user;
  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "");
  if (!text) return NextResponse.json({ findings: [] });
  const findings = scanFindings(text, { location: body.location || "", sourceTool: body.sourceTool || "manual" });
  return NextResponse.json({ findings });
}
