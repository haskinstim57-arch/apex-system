import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the Jarvis LLM fallback chain:
 *   1. Primary Gemini fails → fallback Gemini called
 *   2. Both Gemini calls fail → invokeLLM (Forge) called with same prompt
 *   3. All three fail → user-facing error with clear message
 */

// ── Mock the Gemini SDK ──────────────────────────────────────────────
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

// ── Mock ENV ─────────────────────────────────────────────────────────
vi.mock("./_core/env", () => ({
  ENV: {
    geminiApiKey: "test-gemini-key",
    forgeApiKey: "test-forge-key",
    forgeApiUrl: "https://forge.test.com",
  },
}));

// ── Mock DB logging ──────────────────────────────────────────────────
vi.mock("./db", () => ({
  logGeminiUsage: vi.fn(),
}));

// ── Mock invokeLLM (Forge built-in) ─────────────────────────────────
const mockInvokeLLM = vi.fn();
vi.mock("./_core/llm", () => ({
  invokeLLM: (...args: any[]) => mockInvokeLLM(...args),
}));

import { invokeGeminiWithRetry } from "./services/gemini";
import { logGeminiUsage } from "./db";

// Helper: create a 503 overload error
function make503Error(msg = "503 Service Unavailable: high demand") {
  return new Error(`[GoogleGenerativeAI Error]: ${msg}`);
}

// Helper: create a successful Gemini SDK response
function makeGeminiResponse(text: string) {
  return {
    response: {
      candidates: [
        {
          content: {
            parts: [{ text }],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 20,
        totalTokenCount: 30,
      },
    },
  };
}

// Helper: create a successful invokeLLM (Forge) response
function makeForgeResponse(text: string) {
  return {
    id: "forge-test",
    created: Math.floor(Date.now() / 1000),
    model: "forge-default",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text,
        },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

const testParams = {
  messages: [
    { role: "system" as const, content: "You are a helpful assistant." },
    { role: "user" as const, content: "What is 2+2?" },
  ],
  tools: [
    {
      type: "function" as const,
      function: {
        name: "calculate",
        description: "Do math",
        parameters: { type: "object", properties: { expr: { type: "string" } } },
      },
    },
  ],
  tool_choice: "auto" as const,
  _tracking: {
    accountId: 100,
    userId: 1,
    endpoint: "jarvis.chat",
  },
};

describe("Jarvis LLM Fallback Chain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Scenario 1: Primary fails → fallback Gemini called ────────────

  describe("Primary Gemini fails → fallback Gemini called", () => {
    it("retries with gemini-2.5-flash on 503 and succeeds on second attempt", async () => {
      // First call: 503 error
      mockGenerateContent
        .mockRejectedValueOnce(make503Error())
        // Second call (fallback retry): success
        .mockResolvedValueOnce(makeGeminiResponse("The answer is 4."));

      const result = await invokeGeminiWithRetry(testParams);

      // Should have called generateContent twice
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);

      // Should NOT have called Forge
      expect(mockInvokeLLM).not.toHaveBeenCalled();

      // Should return the successful response
      expect(result.choices[0].message.content).toBe("The answer is 4.");
    });
  });

  // ── Scenario 2: Both Gemini fail → invokeLLM (Forge) called ──────

  describe("Both Gemini calls fail → invokeLLM (Forge) called", () => {
    it("falls back to Forge with same messages but no tools, and prepends limited mode warning", async () => {
      // Both Gemini calls fail with 503
      mockGenerateContent
        .mockRejectedValueOnce(make503Error())
        .mockRejectedValueOnce(make503Error());

      // Forge succeeds
      mockInvokeLLM.mockResolvedValueOnce(makeForgeResponse("The answer is 4."));

      const result = await invokeGeminiWithRetry(testParams);

      // Gemini called twice (primary + fallback)
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);

      // Forge called once
      expect(mockInvokeLLM).toHaveBeenCalledTimes(1);

      // Forge should receive the same messages but NO tools
      const forgeCall = mockInvokeLLM.mock.calls[0][0];
      expect(forgeCall.messages).toEqual(testParams.messages);
      expect(forgeCall.tools).toBeUndefined();
      expect(forgeCall.tool_choice).toBeUndefined();

      // Response should have limited mode warning prepended
      expect(result.choices[0].message.content).toContain(
        "[Jarvis is running in limited mode"
      );
      expect(result.choices[0].message.content).toContain("tool actions unavailable");
      expect(result.choices[0].message.content).toContain("The answer is 4.");

      // tool_calls should be stripped
      expect(result.choices[0].message.tool_calls).toBeUndefined();

      // finish_reason should be "stop" (not "tool_calls")
      expect(result.choices[0].finish_reason).toBe("stop");

      // Model name should indicate forge-fallback
      expect(result.model).toBe("forge-fallback");
    });

    it("logs the Forge fallback incident for tracking", async () => {
      mockGenerateContent
        .mockRejectedValueOnce(make503Error())
        .mockRejectedValueOnce(make503Error());

      mockInvokeLLM.mockResolvedValueOnce(makeForgeResponse("OK"));

      await invokeGeminiWithRetry(testParams);

      // Should have logged usage with model "forge-fallback"
      const logCalls = (logGeminiUsage as ReturnType<typeof vi.fn>).mock.calls;
      const forgeLog = logCalls.find((c: any[]) => c[0].model === "forge-fallback");
      expect(forgeLog).toBeDefined();
      expect(forgeLog![0].success).toBe(true);
      expect(forgeLog![0].endpoint).toBe("jarvis.chat");
    });
  });

  // ── Scenario 3: All three fail → user-facing error ────────────────

  describe("All three fail → user-facing error with clear message", () => {
    it("throws a descriptive error when Gemini primary, Gemini fallback, and Forge all fail", async () => {
      // Both Gemini calls fail
      mockGenerateContent
        .mockRejectedValueOnce(make503Error())
        .mockRejectedValueOnce(make503Error());

      // Forge also fails
      mockInvokeLLM.mockRejectedValueOnce(new Error("Forge API timeout"));

      await expect(invokeGeminiWithRetry(testParams)).rejects.toThrow(
        "All LLM providers failed"
      );

      // All three backends were attempted
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(mockInvokeLLM).toHaveBeenCalledTimes(1);
    });

    it("includes the last error message in the thrown error", async () => {
      mockGenerateContent
        .mockRejectedValueOnce(make503Error())
        .mockRejectedValueOnce(make503Error());

      mockInvokeLLM.mockRejectedValueOnce(new Error("Connection refused"));

      await expect(invokeGeminiWithRetry(testParams)).rejects.toThrow(
        "Connection refused"
      );
    });

    it("logs the all-fallbacks-failed event", async () => {
      mockGenerateContent
        .mockRejectedValueOnce(make503Error())
        .mockRejectedValueOnce(make503Error());

      mockInvokeLLM.mockRejectedValueOnce(new Error("Forge down"));

      try {
        await invokeGeminiWithRetry(testParams);
      } catch {
        // expected
      }

      const logCalls = (logGeminiUsage as ReturnType<typeof vi.fn>).mock.calls;
      const failLog = logCalls.find((c: any[]) => c[0].model === "all-fallbacks-failed");
      expect(failLog).toBeDefined();
      expect(failLog![0].success).toBe(false);
      expect(failLog![0].errorMessage).toContain("Forge down");
    });
  });
});
