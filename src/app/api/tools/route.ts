// GET /api/tools — list available security tools (for the CLI / help panel).

import { NextRequest, NextResponse } from "next/server";
import { TOOL_DEFS } from "@/lib/security-tools";
import { isSessionUser, requireUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!isSessionUser(user)) return user;
  return NextResponse.json({ tools: TOOL_DEFS });
}
