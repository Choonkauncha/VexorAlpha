// POST /api/findings/export — export just the findings of a conversation as CSV or JSON.
// Body: { conversationId, format: "csv" | "json", includeFalsePositives?: boolean }
// Returns: a file download (text/csv or application/json).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { conversationId?: string; format?: string; includeFalsePositives?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const conversationId = (body.conversationId || "").trim();
  const format = body.format === "csv" ? "csv" : "json";
  const includeFP = body.includeFalsePositives !== false; // default true
  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

  const conv = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      findings: {
        where: includeFP ? {} : { falsePositive: false },
        orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!conv) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rows = conv.findings.map((f) => ({
    type: f.type,
    category: f.category,
    severity: f.severity,
    value: f.value,
    masked: f.masked,
    location: f.location,
    sourceTool: f.sourceTool,
    falsePositive: f.falsePositive,
    createdAt: f.createdAt.toISOString(),
  }));

  if (format === "json") {
    return new Response(JSON.stringify({ conversation: conv.title, exportedAt: new Date().toISOString(), count: rows.length, findings: rows }, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="vexor-findings-${conversationId}.json"`,
      },
    });
  }

  // CSV
  const headers = ["Type", "Category", "Severity", "Value", "Masked", "Location", "Source Tool", "False Positive", "Created At"];
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csvLines = [headers.map(escape).join(",")];
  for (const r of rows) {
    csvLines.push([r.type, r.category, r.severity, r.value, r.masked, r.location, r.sourceTool, String(r.falsePositive), r.createdAt].map(escape).join(","));
  }
  return new Response(csvLines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="vexor-findings-${conversationId}.csv"`,
    },
  });
}
