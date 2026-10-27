// Per-request AsyncLocalStorage so LLM key lookup can prefer the caller's
// BYOK keys without leaking across concurrent serverless invocations.

import { AsyncLocalStorage } from "node:async_hooks";

export type ProviderKeyBag = Partial<Record<"openai" | "google" | "anthropic" | "openrouter" | "zai", string>>;

export type RequestStore = {
  userId: string;
  providerKeys: ProviderKeyBag;
};

export const requestContext = new AsyncLocalStorage<RequestStore>();

export function getRequestProviderKeys(): ProviderKeyBag {
  return requestContext.getStore()?.providerKeys || {};
}
