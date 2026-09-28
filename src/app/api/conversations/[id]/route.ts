// /api/conversations/[id]
// GET    — full conversation: messages, findings, exploits, tool calls
// PATCH  — { title?, pinned? }
// DELETE — remove

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const conv = await db.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      findings: { orderBy: [{ severity: "asc" }, { createdAt: "asc" }] },
      exploits: { orderBy: [{ severity: "asc" }, { createdAt: "asc" }] },
      toolCalls: { orderBy: { createdAt: "asc" } },
      tags: true,
    },
  });
  if (!conv) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    id: conv.id,
    title: conv.title,
    pinned: conv.pinned,
    favorited: conv.favorited,
    archived: conv.archived,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    tags: conv.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    messages: conv.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      metadata: (() => { try { return JSON.parse(m.metadata); } catch { return {}; } })(),
      createdAt: m.createdAt,
    })),
    findings: conv.findings.map((f) => ({
      id: f.fingerprint,
      category: f.category,
      type: f.type,
      value: f.value,
      masked: f.masked,
      location: f.location,
      sourceTool: f.sourceTool,
      severity: f.severity,
      revealed: f.revealed,
      falsePositive: f.falsePositive,
      createdAt: f.createdAt,
    })),
    exploits: conv.exploits.map((e) => ({
      id: e.fingerprint,
      title: e.title,
      severity: e.severity,
      status: e.status,
      location: e.location,
      exploitInstructions: e.exploitInstructions,
      exploitCode: e.exploitCode,
      patchInstructions: e.patchInstructions,
      patchCode: e.patchCode,
      language: e.language,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
    toolCalls: conv.toolCalls.map((t) => ({
      id: t.id,
      name: t.name,
      arguments: t.arguments,
      output: t.output,
      durationMs: t.durationMs,
      createdAt: t.createdAt,
    })),
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const data: { title?: string; pinned?: boolean; favorited?: boolean; archived?: boolean } = {};
  if (typeof body.title === "string") data.title = body.title.slice(0, 120);
  if (typeof body.pinned === "boolean") data.pinned = body.pinned;
  if (typeof body.favorited === "boolean") data.favorited = body.favorited;
  if (typeof body.archived === "boolean") data.archived = body.archived;
  const conv = await db.conversation.update({ where: { id }, data });
  return NextResponse.json({ id: conv.id, title: conv.title, pinned: conv.pinned, favorited: conv.favorited, archived: conv.archived, updatedAt: conv.updatedAt });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await db.conversation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
