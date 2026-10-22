// The Vexor agent loop — runs the LLM with the security system prompt,
// parses <tool_call> blocks, executes tools server-side, files findings &
// exploits, and yields a stream of AgentEvents (SSE-friendly).

import { db } from "./db";
import { createProviderStream, ProviderError, providerModels, providerOrder, type ProviderId } from "./llm";
import { SYSTEM_PROMPT } from "./system-prompt";
import { runTool, scanToolOutput } from "./security-tools";
import { makeExploitEntry, mergeExploit } from "./exploits";
import { mergeFindings } from "./findings";
import type { AgentEvent, ChatMessage } from "./types";

const TOOL_CALL_RE = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
const TOOL_CALL_RE_SINGLE = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/;
const MAX_OUTPUT_CHARS = 5000;

interface LoopDeps {
  conversationId: string;
  history: ChatMessage[];   // prior messages (user + assistant), no system prompt
  provider: string;
  model: string;
  scope: string;            // authorized target scope
  maxIterations: number;
  thinkingBudget: number;
  temperature: number | null;
  signal?: AbortSignal;
}

// Sanitize messages for the API: strip display-only metadata.
function sanitize(messages: ChatMessage[]): { role: "system" | "user" | "assistant"; content: string }[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
}

// Parse ALL <tool_call> blocks from a model response.
// The model often emits multiple tool calls in a single turn (e.g. inspect →
// catalog_exploit → catalog_exploit → final_message). We must extract and
// execute ALL of them, not just the first.
//
// Handles:
//  - Complete blocks: <tool_call>...</tool_call>
//  - Missing closing tags: <tool_call>... (up to next <tool_call> or end)
//  - Malformed JSON (trailing chars, extra braces) via tryParseLenient
function extractAllToolCalls(text: string): { name: string; arguments: Record<string, unknown> }[] {
  const calls: { name: string; arguments: Record<string, unknown> }[] = [];

  // Strategy: find all <tool_call> positions, then for each, grab content up to
  // the next <tool_call> or </tool_call> or end of text.
  const openTag = "<tool_call>";
  const positions: number[] = [];
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf(openTag, searchFrom);
    if (idx === -1) break;
    positions.push(idx);
    searchFrom = idx + openTag.length;
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i] + openTag.length;
    // Content ends at the next <tool_call>, or </tool_call>, or end of text.
    let end = text.length;
    const nextOpen = text.indexOf(openTag, start);
    const closeTag = text.indexOf("</tool_call>", start);
    if (nextOpen !== -1) end = Math.min(end, nextOpen);
    if (closeTag !== -1) end = Math.min(end, closeTag);

    const raw = text.slice(start, end).trim();
    const parsed = tryParseLenient(raw);
    if (parsed && typeof parsed.name === "string") {
      calls.push({ name: parsed.name, arguments: parsed.arguments || {} });
    } else {
      console.log(`[agent] failed to parse tool_call JSON: ${raw.slice(0, 120)}`);
    }
  }

  return calls;
}

// Lenient JSON parser: tries to parse, then progressively trims trailing
// characters until it succeeds (handles trailing braces, commas, whitespace).
function tryParseLenient(raw: string): any | null {
  // First try direct parse.
  try { return JSON.parse(raw); } catch {}

  // Try trimming trailing non-JSON chars (extra } etc).
  let s = raw;
  for (let i = 0; i < 5; i++) {
    s = s.replace(/[\s,}\])]+$/, "");
    try { return JSON.parse(s); } catch {}
  }

  // Try extracting the first {...} block via brace matching.
  const start = raw.indexOf("{");
  if (start >= 0) {
    let depth = 0;
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === "{") depth++;
      else if (raw[i] === "}") { depth--; if (depth === 0) { try { return JSON.parse(raw.slice(start, i + 1)); } catch {} break; } }
    }
  }
  return null;
}

// Parse the first <tool_call> block out of a model response (single-call compat).
function extractToolCall(text: string): { name: string; arguments: Record<string, unknown> } | null {
  const m = text.match(TOOL_CALL_RE_SINGLE);
  if (!m) return null;
  const parsed = tryParseLenient(m[1].trim());
  if (parsed && typeof parsed.name === "string") {
    return { name: parsed.name, arguments: parsed.arguments || {} };
  }
  return null;
}

// Strip the tool_call block(s) from the visible text the user sees.
// Handles both <tool_call>...</tool_call> and <tool_call>... (no closing tag).
function stripToolCalls(text: string): string {
  let s = text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "");
  s = s.replace(/<tool_call>[\s\S]*$/g, "");
  return s.trim();
}

// Truncate tool output for display + LLM context.
function truncate(text: string, limit = MAX_OUTPUT_CHARS): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + `\n... [truncated, ${text.length} total chars]`;
}

// Persist a finding (de-duped by fingerprint).
async function persistFindings(conversationId: string, findings: { id: string; category: string; type: string; value: string; masked: string; location: string; sourceTool: string; severity: string }[]): Promise<number> {
  let added = 0;
  for (const f of findings) {
    try {
      await db.finding.create({
        data: {
          conversationId,
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
      added++;
    } catch {
      // unique constraint → already filed, skip
    }
  }
  return added;
}

async function persistExploit(conversationId: string, args: Record<string, unknown>): Promise<boolean> {
  const entry = makeExploitEntry(args);
  if (!entry) return false;
  await db.exploit.upsert({
    where: { conversationId_fingerprint: { conversationId, fingerprint: entry.id } },
    create: {
      conversationId,
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
      severity: entry.severity,
      location: entry.location,
      exploitInstructions: entry.exploitInstructions,
      exploitCode: entry.exploitCode,
      patchInstructions: entry.patchInstructions,
      patchCode: entry.patchCode,
      language: entry.language,
    },
  });
  return true;
}

async function persistToolCall(conversationId: string, name: string, args: Record<string, unknown>, output: string, durationMs: number): Promise<void> {
  await db.toolCall.create({
    data: { conversationId, name, arguments: JSON.stringify(args), output: output.slice(0, 2000), durationMs },
  });
}

async function persistMessage(conversationId: string, role: string, content: string, metadata: Record<string, unknown> = {}): Promise<void> {
  await db.message.create({
    data: { conversationId, role, content, metadata: JSON.stringify(metadata) },
  });
}

export async function* runAgentLoop(deps: LoopDeps): AsyncGenerator<AgentEvent> {
  const { conversationId, history, provider, model, scope, maxIterations, thinkingBudget, temperature, signal } = deps;
  const providers = providerOrder(provider);
  if (!providers.length) {
    yield { type: "error", content: "No configured AI providers. Set an API key or configure Z.ai before starting a chat." };
    return;
  }
  let activeProvider: ProviderId = providers[0];
  const activeModels = new Map<ProviderId, string>();

  // Build a dynamic system prompt that includes the current authorization
  // scope, so the agent KNOWS what it's allowed to test without asking.
  const allowAll = scope.trim() === "*";
  const scopeInfo = allowAll
    ? `=== AUTHORIZATION STATUS: ALLOW ALL ===
You are authorized to test ANY host. The user has enabled "Allow All" mode. Do NOT pause to ask for scope confirmation — proceed immediately with network tools against any target the user specifies. You are cleared for: dns_lookup, tls_inspect, fingerprint_web_tech, discover_paths, analyze_js_bundles, http_probe, analyze_security_headers, test_cors — against ANY host.`
    : scope.trim()
      ? `=== AUTHORIZATION STATUS: SCOPED ===
You are authorized to test the following hosts ONLY: ${scope.trim()}
Network tools (dns_lookup, tls_inspect, fingerprint_web_tech, discover_paths, analyze_js_bundles, http_probe, analyze_security_headers, test_cors) will work against these hosts. If the user asks about a host NOT in this list, inform them they need to add it to Settings → Target scope first. Do NOT pause to ask for confirmation — just proceed if the host is in scope.`
      : `=== AUTHORIZATION STATUS: NO SCOPE ===
No authorized target scope is set. Network tools (dns_lookup, tls_inspect, fingerprint_web_tech, discover_paths, analyze_js_bundles, http_probe, analyze_security_headers, test_cors) will REFUSE to run. Tell the user to set a scope in Settings → Target scope (or enable "Allow All") before running network recon. You can still use non-network tools (jwt_inspect, identify_hash, transform_payload, generate_attack_payloads, cve_lookup, fetch_webpage, catalog_exploit).`;

  const dynamicSystemPrompt = SYSTEM_PROMPT + "\n\n" + scopeInfo;

  // Working message list (system + history). Tool results are appended as
  // assistant messages describing what happened, since the SDK doesn't expose
  // native tool-calling — we simulate it via the <tool_call> protocol.
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: dynamicSystemPrompt },
    ...sanitize(history),
  ];

  // === Autonomous loop state ===
  let textOnlyStreak = 0;          // consecutive turns with no tool_call
  let actionCount = 0;             // total real tool actions (not text-only)
  const recentToolCalls: string[] = [];  // for repetition detection (name + args hash)

  for (let iter = 0; iter < maxIterations; iter++) {
    if (signal?.aborted) {
      yield { type: "error", content: "Run cancelled by the user." };
      return;
    }

    // Emit a progress event so the UI can show "turn N of M" + action count.
    yield { type: "progress", iteration: iter, maxIterations, actionCount } as any;

    let fullText = "";
    let reasoning = "";
    let firstChunk = true;

    console.log(`[agent] iter ${iter} — calling LLM (thinking=${thinkingBudget > 0 ? "enabled" : "disabled"}, temp=${temperature}, msgs=${messages.length}, actions=${actionCount}, textOnlyStreak=${textOnlyStreak})`);
    const callStart = Date.now();
    try {
      let completed = false;
      const orderedProviders = [activeProvider, ...providers.filter((candidate) => candidate !== activeProvider)];
      // Flatten to (provider, model) attempts: every free model of a provider
      // (see model-fallbacks.ts), then the next provider's models.
      const attempts = orderedProviders.flatMap((candidate) => {
        // A user-picked model string only applies to the provider it was
        // picked for — never carry it over to a fallback provider.
        const requested = candidate === provider ? model : "";
        const list = providerModels(candidate, requested);
        // Prefer the model that last answered on this provider.
        const sticky = activeModels.get(candidate);
        const ordered = sticky && list.includes(sticky) ? [sticky, ...list.filter((m) => m !== sticky)] : list;
        return ordered.map((candidateModel) => ({ candidate, candidateModel }));
      });
      let lastError: ProviderError | undefined;
      for (let i = 0; i < attempts.length; i++) {
        const { candidate, candidateModel } = attempts[i];
        let produced = false;
        try {
          console.log(`[agent] iter ${iter} — provider=${candidate}, model=${candidateModel}`);
          for await (const chunk of createProviderStream({ provider: candidate, model: candidateModel, messages, thinkingBudget, temperature, signal })) {
            if (signal?.aborted) break;
            if (chunk.reasoning) {
              produced = true;
              reasoning += chunk.reasoning;
              yield { type: "reasoning", content: chunk.reasoning };
            }
            if (chunk.content) {
              produced = true;
              if (firstChunk) {
                console.log(`[agent] first text chunk in ${Date.now() - callStart}ms`);
                firstChunk = false;
              }
              fullText += chunk.content;
              yield { type: "text", content: chunk.content };
            }
          }
          if (!produced && !signal?.aborted) throw new ProviderError(`${candidate}/${candidateModel} returned an empty response`, candidate);
          activeProvider = candidate;
          activeModels.set(candidate, candidateModel);
          console.log(`[agent] iter ${iter} — answered by provider=${candidate}, model=${candidateModel}`);
          completed = true;
          break;
        } catch (e: any) {
          const error = e instanceof ProviderError ? e : new ProviderError(e?.message || String(e), candidate);
          lastError = error;
          // Don't retry once output has streamed (it would duplicate text),
          // on user cancel, or on non-transient errors such as bad auth.
          if (produced || signal?.aborted || !error.isRetryable) throw error;
          const next = attempts[i + 1];
          if (!next) throw error;
          const label = `${next.candidate}/${next.candidateModel}`;
          console.warn(`[agent] ${candidate}/${candidateModel} failed (${error.status ?? "error"}): ${error.message.slice(0, 200)} — trying ${label}`);
          yield { type: "reasoning", content: `Model ${candidate}/${candidateModel} unavailable (${error.isRateLimit ? "rate limited" : error.status ?? "error"}); switching to ${label}.` };
        }
      }
      if (!completed && lastError) throw lastError;
      if (!completed) throw new Error("All configured providers failed");

      console.log(`[agent] iter ${iter} done in ${Date.now() - callStart}ms — text=${fullText.length} chars, reasoning=${reasoning.length} chars`);
    } catch (e: any) {
      console.error(`[agent] LLM error after ${Date.now() - callStart}ms:`, e?.message || e);
      yield { type: "error", content: `Model request failed: ${e.message}` };
      return;
    }

    const visibleText = stripToolCalls(fullText);

    // Persist the assistant text message (skip empty turn-pure tool calls).
    if (visibleText) {
      await persistMessage(conversationId, "assistant", visibleText);
    }

    // Extract ALL tool calls from the response (the model often emits
    // multiple in a single turn: inspect → catalog → catalog → final_message).
    const allCalls = extractAllToolCalls(fullText);

    if (allCalls.length === 0) {
      // === NO TOOL CALL — autonomous loop continuation ===
      textOnlyStreak++;
      console.log(`[agent] no tool_call — textOnlyStreak=${textOnlyStreak}`);

      if (textOnlyStreak >= 2) {
        yield { type: "done", content: visibleText };
        return;
      }

      const isReport = /#\s*\[Security Audit/i.test(visibleText);
      const nudge = isReport
        ? "You emitted a final report. Now call final_message to formally end the audit:\n\n<tool_call>\n{\"name\": \"final_message\", \"arguments\": {}}\n</tool_call>"
        : "You emitted a response WITHOUT a tool_call. You MUST call a tool every turn. If the audit is complete, emit your report and call final_message. Otherwise, call the next tool to continue the audit. Do NOT emit prose-only responses.";

      messages.push({ role: "assistant", content: fullText });
      messages.push({ role: "user", content: nudge });
      continue;
    }

    // === TOOL CALLS — execute ALL of them sequentially ===
    textOnlyStreak = 0;
    console.log(`[agent] iter ${iter} — ${allCalls.length} tool call(s): ${allCalls.map((c) => c.name).join(", ")}`);

    // Push the full assistant response (with all tool_call blocks) to messages.
    messages.push({ role: "assistant", content: fullText });

    // Build a combined results message for the next LLM turn.
    const resultParts: string[] = [];

    for (let ci = 0; ci < allCalls.length; ci++) {
      const { name, arguments: toolArgs } = allCalls[ci];
      if (signal?.aborted) break;

      // Emit the tool-call event for the UI.
      yield { type: "tool_call", name, arguments: JSON.stringify(toolArgs) };

      // final_message → end the loop immediately.
      if (name === "final_message") {
        await persistMessage(conversationId, "assistant", visibleText, { kind: "tool", toolName: name });
        yield { type: "tool_output", name, arguments: "{}", content: "Audit complete — final report delivered." };
        yield { type: "done", content: visibleText };
        return;
      }

      // Repetition detection.
      const argsHash = JSON.stringify(toolArgs);
      const callKey = `${name}:${argsHash}`;
      recentToolCalls.push(callKey);
      if (recentToolCalls.length > 5) recentToolCalls.shift();
      const repeatCount = recentToolCalls.filter((k) => k === callKey).length;
      if (repeatCount >= 3) {
        console.log(`[agent] repetition detected: ${name} called ${repeatCount}x with same args`);
        yield { type: "reasoning", content: `⚠ Repetition detected: ${name} called ${repeatCount}× with identical args. Trying a different approach.` };
      }

      // Run the tool.
      actionCount++;
      const started = Date.now();
      let output: string;
      try {
        const res = await runTool(name, toolArgs, scope);
        output = res.output;
        if (res.isCatalog && res.exploitArgs) {
          await persistExploit(conversationId, res.exploitArgs);
        }
        if (output && !res.isCatalog) {
          const findings = scanToolOutput(name, toolArgs, output);
          if (findings.length) await persistFindings(conversationId, findings);
        }
      } catch (e: any) {
        output = `Tool ${name} failed: ${e.message}`;
      }
      const durationMs = Date.now() - started;

      const truncOutput = truncate(output);
      yield { type: "tool_output", name, arguments: JSON.stringify(toolArgs), content: truncOutput };

      await persistToolCall(conversationId, name, toolArgs, output, durationMs);
      await persistMessage(conversationId, "assistant", `${name}(${JSON.stringify(toolArgs)})\n\nOutput:\n${truncOutput}`, { kind: "tool", toolName: name });

      resultParts.push(`Tool ${name} result:\n${truncOutput}`);
    }

    // Feed ALL tool results back to the model as a single user message.
    const repetitionNudge = recentToolCalls.length >= 3 && recentToolCalls.filter((k) => k === recentToolCalls[recentToolCalls.length - 1]).length >= 3
      ? `\n\n⚠ You have repeated the same tool call. Try a DIFFERENT tool, a different endpoint, or move to the next phase of the audit.`
      : "";
    messages.push({
      role: "user",
      content: `${resultParts.join("\n\n---\n\n")}\n\nProgress: ${actionCount} tool action(s) completed (turn ${iter + 1}/${maxIterations}).${repetitionNudge}\n\nContinue the audit. Call the next tool. If you have confirmed a vulnerability, call catalog_exploit now. If the audit is complete, emit your final report and call final_message.`,
    });
  }

  yield { type: "done", content: `Reached the maximum number of turns (${maxIterations}). The agent performed ${actionCount} tool action(s). Increase 'Max turns' in Agent controls for a longer audit.` };
}

// Merge helper for in-memory exploit/findings lists (used by the UI's live
// preview before persistence round-trips).
export { mergeExploit, mergeFindings };
