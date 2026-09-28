// POST /api/findings/bulk — bulk delete findings by fingerprint.
// Body: { conversationId: string, fingerprints: string[] }
// Returns: { deleted: number }
//
// Used by the findings vault bulk-action bar to let analysts select multiple
// findings and remove them (e.g. false positives).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { conversationId?: string; fingerprints?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const conversationId = (body.conversationId || "").trim();
  const fingerprints = body.fingerprints || [];
  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  if (!fingerprints.length) return NextResponse.json({ deleted: 0 });

  const result = await db.finding.deleteMany({
    where: { conversationId, fingerprint: { in: fingerprints } },
  });
  return NextResponse.json({ deleted: result.count });
}
