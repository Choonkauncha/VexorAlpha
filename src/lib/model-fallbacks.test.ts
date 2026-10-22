/// <reference types="bun-types" />
import { describe, expect, test, afterEach } from "bun:test";
import { FREE_MODELS, providerModels } from "./model-fallbacks";
import { ProviderError } from "./llm";

afterEach(() => { delete process.env.GOOGLE_MODELS; delete process.env.GOOGLE_MODEL; });

describe("providerModels", () => {
  test("returns the free list in order", () => {
    expect(providerModels("google")).toEqual(FREE_MODELS.google);
  });
  test("user-picked model goes first, no duplicates", () => {
    const list = providerModels("openrouter", "openrouter/free");
    expect(list[0]).toBe("openrouter/free");
    expect(new Set(list).size).toBe(list.length);
  });
  test("env list overrides; single env model tried first", () => {
    process.env.GOOGLE_MODELS = "a, b";
    process.env.GOOGLE_MODEL = "c";
    expect(providerModels("google")).toEqual(["c", "a", "b"]);
  });
  test("providers without a free tier keep their default", () => {
    expect(providerModels("openai")).toEqual(["gpt-4o-mini"]);
  });
});

describe("ProviderError.isRetryable", () => {
  const e = (msg: string, status?: number) => new ProviderError(msg, "google", status);
  test("retries 429, 5xx, 404, timeouts, quota", () => {
    for (const err of [e("x", 429), e("x", 503), e("x", 404), e("timed out", 408), e("RESOURCE_EXHAUSTED quota")]) expect(err.isRetryable).toBe(true);
  });
  test("does not retry auth errors", () => {
    expect(e("invalid api key", 401).isRetryable).toBe(false);
  });
});
