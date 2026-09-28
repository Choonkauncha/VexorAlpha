// GET /api/tools — list available security tools (for the CLI / help panel).

import { NextResponse } from "next/server";
import { TOOL_DEFS } from "@/lib/security-tools";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ tools: TOOL_DEFS });
}
