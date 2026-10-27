import { withJsonErrors } from "@/lib/api-utils";
// GET /api/settings  — current settings (per-user)
// PUT /api/settings  — patch { provider?, model?, theme?, targetScope?, runtime?, providerKeys? }

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadSettings, saveSettings } from "@/lib/settings";
import { isSessionUser, requireUser } from "@/lib/auth";

const settingsPatch = z.object({
  provider: z.enum(["zai", "openai", "google", "anthropic", "openrouter"]).optional(),
  model: z.string().trim().max(200).optional(),
  theme: z.enum(["dark", "light"]).optional(),
  targetScope: z.string().max(10000).optional(),
  runtime: z.object({
    maxIterations: z.number().int().min(1).max(100).optional(),
    minActions: z.number().int().min(0).max(30).optional(),
    thinkingBudget: z.number().int().min(0).max(8000).optional(),
    temperature: z.number().min(0).max(2).nullable().optional(),
    reflectEvery: z.number().int().min(0).max(20).optional(),
  }).strict().optional(),
  providerKeys: z.object({
    openai: z.string().max(500).optional(),
    google: z.string().max(500).optional(),
    anthropic: z.string().max(500).optional(),
    openrouter: z.string().max(500).optional(),
    zai: z.string().max(500).optional(),
  }).strict().optional(),
}).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withJsonErrors(async (req: NextRequest) => {
  const user = requireUser(req);
  if (!isSessionUser(user)) return user;
  return NextResponse.json(await loadSettings(user.id));
});

export const PUT = withJsonErrors(async (req: NextRequest) => {
  const user = requireUser(req);
  if (!isSessionUser(user)) return user;
  const result = settingsPatch.safeParse(await req.json());
  if (!result.success) return NextResponse.json({ error: "Invalid settings. Check the field values and try again." }, { status: 400 });
  const updated = await saveSettings(user.id, result.data);
  return NextResponse.json(updated);
});
