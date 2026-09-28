// POST /api/chat — streaming agent run.
// Body: { conversationId: string, message: string }
// Response: text/event-stream of AgentEvent JSON lines.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { runAgentLoop } from "@/lib/agent";
import { loadSettings } from "@/lib/settings";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  let body: { conversationId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const conversationId = (body.conversationId || "").trim();
  const message = (body.message || "").trim();
  if (!conversationId) return new Response(JSON.stringify({ error: "conversationId required" }), { status: 400, headers: { "content-type": "application/json" } });
  if (!message) return new Response(JSON.stringify({ error: "message required" }), { status: 400, headers: { "content-type": "application/json" } });

  const conv = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) return new Response(JSON.stringify({ error: "conversation not found" }), { status: 404, headers: { "content-type": "application/json" } });

  // Persist the user's message.
  await db.message.create({ data: { conversationId, role: "user", content: message } });

  // Load history (this conversation's messages), append the new user message.
  const rows = await db.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
  const history: ChatMessage[] = rows.map((r) => ({
    role: r.role as ChatMessage["role"],
    content: r.content,
    metadata: (() => { try { return JSON.parse(r.metadata); } catch { return {}; } })(),
  }));

  const settings = await loadSettings();

  // Abort controller wired to the request close event.
  const ac = new AbortController();
  req.signal.addEventListener("abort", () => ac.abort());

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (ev: unknown) => controller.enqueue(encoder.encode(sse(ev)));
      let doneSent = false;
      try {
        for await (const ev of runAgentLoop({
          conversationId,
          history,
          provider: settings.provider,
          model: settings.model,
          scope: settings.targetScope,
          maxIterations: settings.runtime.maxIterations,
          thinkingBudget: settings.runtime.thinkingBudget,
          temperature: settings.runtime.temperature,
          signal: ac.signal,
        })) {
          if (ev.type === "done") doneSent = true;
          send(ev);
        }
        // Update conversation timestamp + auto-title.
        const title = conv.title === "New conversation" ? message.slice(0, 60) : conv.title;
        await db.conversation.update({ where: { id: conversationId }, data: { title } });
      } catch (e: any) {
        send({ type: "error", content: e?.message || String(e) });
      } finally {
        if (!doneSent) send({ type: "done", content: "" });
        controller.close();
      }
    },
    cancel() {
      ac.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
