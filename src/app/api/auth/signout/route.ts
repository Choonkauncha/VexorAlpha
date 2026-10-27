import { NextResponse } from "next/server";
import { withJsonErrors } from "@/lib/api-utils";
import { clearSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withJsonErrors(async () => {
  return clearSession(NextResponse.json({ ok: true }));
});
