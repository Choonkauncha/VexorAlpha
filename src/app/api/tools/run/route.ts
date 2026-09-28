// POST /api/tools/run — run a single security tool directly (no LLM).
// Body: { name: string, arguments: Record<string, unknown> }
// Returns: { output: string, findings?: Finding[], exploitFiled?: boolean }
//
// This powers the interactive Tool Tester panel — analysts can run any of the
// 16 read-only defensive tools manually for quick recon, gated by the same
// authorized-scope check the agent uses.

import { NextRequest, NextResponse } from "next/server";
import { runTool, scanToolOutput } from "@/lib/security-tools";
import { loadSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { makeExploitEntry } from "@/lib/exploits";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { name?: string; arguments?: Record<string, unknown>; conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = (body.name || "").trim();
  const args = body.arguments || {};
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const settings = await loadSettings();
  const started = Date.now();

  try {
    const res = await runTool(name, args, settings.targetScope);
    const durationMs = Date.now() - started;
    const out: { output: string; findings?: typeof import("@/lib/types").Finding[]; exploitFiled?: boolean; durationMs: number } = {
      output: res.output,
      durationMs,
    };

    // Auto-scan output for findings (same as the agent loop).
    if (res.output && !res.isCatalog) {
      out.findings = scanToolOutput(name, args, res.output);
    }

    // Persist to a conversation if one was provided.
    if (body.conversationId) {
      const conv = await db.conversation.findUnique({ where: { id: body.conversationId } });
      if (conv) {
        // Persist the tool call.
        await db.toolCall.create({
          data: { conversationId: conv.id, name, arguments: JSON.stringify(args), output: res.output.slice(0, 2000), durationMs },
        });
        // Persist findings (de-duped by fingerprint).
        if (out.findings) {
          for (const f of out.findings) {
            try {
              await db.finding.create({
                data: {
                  conversationId: conv.id,
                  fingerprint: f.id,
                  category: f.category,
                  type: f.type,
                  value: f.value,
                  masked: f.masked,
                  location: f.location,
                  sourceTool: f.sourceTool,
                  severity: f.severity,
                },
              });
            } catch {
              /* unique constraint → already filed */
            }
          }
        }
        // Persist exploit if catalog_exploit was called manually.
        if (res.isCatalog && res.exploitArgs) {
          const entry = makeExploitEntry(res.exploitArgs);
          if (entry) {
            await db.exploit.upsert({
              where: { conversationId_fingerprint: { conversationId: conv.id, fingerprint: entry.id } },
              create: {
                conversationId: conv.id,
                fingerprint: entry.id,
                title: entry.title,
                severity: entry.severity,
                location: entry.location,
                exploitInstructions: entry.exploitInstructions,
                exploitCode: entry.exploitCode,
                patchInstructions: entry.patchInstructions,
                patchCode: entry.patchCode,
                language: entry.language,
              },
              update: {
                severity: entry.severity, location: entry.location,
                exploitInstructions: entry.exploitInstructions, exploitCode: entry.exploitCode,
                patchInstructions: entry.patchInstructions, patchCode: entry.patchCode, language: entry.language,
              },
            });
            out.exploitFiled = true;
          }
        }
      }
    }

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e), durationMs: Date.now() - started }, { status: 500 });
  }
}
