// Shared types for the Vexor agent + UI.

export type Role = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  id?: string;
  role: Role;
  content: string;
  metadata?: MessageMetadata;
  createdAt?: string;
}

export interface MessageMetadata {
  title?: string;
  kind?: "text" | "thought" | "tool" | "error" | "system";
  toolName?: string;
  toolArgs?: string;
  durationMs?: number;
  footer?: string;
}

// Streaming event contract for the agent loop.
export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "reasoning"; content: string }
  | { type: "tool_call"; name: string; arguments: string }
  | { type: "tool_output"; name: string; arguments: string; content: string; partial?: boolean }
  | { type: "progress"; iteration: number; maxIterations: number; actionCount?: number }
  | { type: "done"; content: string }
  | { type: "error"; content: string };

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  id: string;            // stable fingerprint
  category: FindingCategory;
  type: string;
  value: string;
  masked: string;
  location: string;
  sourceTool: string;
  severity: Severity;
  revealed?: boolean;
  falsePositive?: boolean;
}

export type FindingCategory =
  | "credentials"
  | "api_keys"
  | "tokens"
  | "pii"
  | "exposed"
  | "endpoints";

export interface Exploit {
  id: string;            // stable fingerprint
  title: string;
  severity: Severity;
  status: ExploitStatus;
  location: string;
  exploitInstructions: string;
  exploitCode: string;
  patchInstructions: string;
  patchCode: string;
  language: string;
}

export type ExploitStatus = "open" | "remediated" | "verified";

export interface ConversationSummary {
  id: string;
  title: string;
  pinned: boolean;
  favorited?: boolean;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  findingCount?: number;
  exploitCount?: number;
  tags?: { id: string; name: string; color: string }[];
}

export interface TagInfo {
  name: string;
  color: string;
  count: number;
}

export interface AgentRuntimeParams {
  maxIterations: number;
  minActions: number;
  thinkingBudget: number;
  temperature: number | null; // null = auto
  reflectEvery: number;
}

export const DEFAULT_RUNTIME_PARAMS: AgentRuntimeParams = {
  maxIterations: 40,
  minActions: 0,
  thinkingBudget: 0,
  temperature: null,
  reflectEvery: 6,
};

export interface AppSettings {
  provider: string;
  model: string;
  theme: "dark" | "light";
  targetScope: string; // authorized-target declaration the user acknowledges
  runtime: AgentRuntimeParams;
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "zai",
  model: "glm-4.6",
  theme: "light",
  targetScope: "",
  runtime: { ...DEFAULT_RUNTIME_PARAMS },
};
