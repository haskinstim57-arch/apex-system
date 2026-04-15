/**
 * Gemini SDK Wrapper for Jarvis
 *
 * Calls the Google Gemini API directly using @google/generative-ai SDK.
 * Provides function calling support and returns results in the same
 * shape as the built-in invokeLLM (OpenAI-compatible InvokeResult).
 */
import {
  GoogleGenerativeAI,
  type Content,
  type Part,
  type FunctionDeclaration,
  type Tool as GeminiTool,
  type FunctionCall,
  type GenerateContentResult,
} from "@google/generative-ai";
import { ENV } from "../_core/env";
import type { Message, Tool, ToolCall, InvokeResult } from "../_core/llm";
import { logGeminiUsage } from "../db";

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const key = ENV.geminiApiKey;
    if (!key) {
      throw new Error("[Jarvis] GEMINI_API_KEY is not set!");
    }
    _genAI = new GoogleGenerativeAI(key);
    console.log("[Jarvis] Gemini SDK initialized with API key");
  }
  return _genAI;
}

// ═══════════════════════════════════════════════
// CONVERT OpenAI Tool → Gemini FunctionDeclaration
// ═══════════════════════════════════════════════

function convertToolsToGemini(tools: Tool[]): GeminiTool[] {
  const functionDeclarations: FunctionDeclaration[] = tools.map((t) => {
    const params = t.function.parameters || {};
    return {
      name: t.function.name,
      description: t.function.description || "",
      parameters: sanitizeSchemaForGemini(params) as any,
    };
  });

  return [{ functionDeclarations }];
}

/**
 * Gemini is strict about JSON Schema — it doesn't accept `additionalProperties`.
 * We need to strip that and ensure the schema is clean.
 */
function sanitizeSchemaForGemini(schema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    // Gemini doesn't support additionalProperties
    if (key === "additionalProperties") continue;

    if (key === "properties" && typeof value === "object" && value !== null) {
      const props: Record<string, unknown> = {};
      for (const [propName, propValue] of Object.entries(value as Record<string, unknown>)) {
        if (typeof propValue === "object" && propValue !== null) {
          props[propName] = sanitizeSchemaForGemini(propValue as Record<string, unknown>);
        } else {
          props[propName] = propValue;
        }
      }
      result[key] = props;
    } else if (key === "items" && typeof value === "object" && value !== null) {
      result[key] = sanitizeSchemaForGemini(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ═══════════════════════════════════════════════
// CONVERT OpenAI Messages → Gemini Contents
// ═══════════════════════════════════════════════

interface ConvertedMessages {
  systemInstruction: string | undefined;
  contents: Content[];
}

function convertMessagesToGemini(messages: Message[]): ConvertedMessages {
  let systemInstruction: string | undefined;
  const contents: Content[] = [];

  for (const msg of messages) {
    const textContent = typeof msg.content === "string"
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.map((p) => (typeof p === "string" ? p : "type" in p && p.type === "text" ? (p as any).text : "")).join("\n")
        : "";

    if (msg.role === "system") {
      systemInstruction = textContent;
      continue;
    }

    if (msg.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: textContent || " " }],
      });
      continue;
    }

    if (msg.role === "assistant") {
      const parts: Part[] = [];

      // Check if this message has tool_calls (function calls from the model)
      const toolCalls = (msg as any).tool_calls as ToolCall[] | undefined;
      if (toolCalls && toolCalls.length > 0) {
        for (const tc of toolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}");
          } catch { /* empty */ }
          parts.push({
            functionCall: {
              name: tc.function.name,
              args,
            },
          } as Part);
        }
        // Also include text content if present
        if (textContent) {
          parts.push({ text: textContent });
        }
      } else {
        parts.push({ text: textContent || " " });
      }

      contents.push({ role: "model", parts });
      continue;
    }

    if (msg.role === "tool") {
      // Tool results → functionResponse
      let responseData: unknown;
      try {
        responseData = JSON.parse(textContent);
      } catch {
        responseData = { result: textContent };
      }

      // Find the function name from the tool_call_id by looking back in messages
      const toolCallId = msg.tool_call_id;
      let functionName = "unknown_function";

      // Search backwards for the assistant message with matching tool_call
      for (let i = messages.indexOf(msg) - 1; i >= 0; i--) {
        const prevMsg = messages[i] as any;
        if (prevMsg.role === "assistant" && prevMsg.tool_calls) {
          const matchingCall = prevMsg.tool_calls.find((tc: ToolCall) => tc.id === toolCallId);
          if (matchingCall) {
            functionName = matchingCall.function.name;
            break;
          }
        }
      }

      contents.push({
        role: "function",
        parts: [{
          functionResponse: {
            name: functionName,
            response: responseData as object,
          },
        } as Part],
      });
      continue;
    }
  }

  return { systemInstruction, contents };
}

// ═══════════════════════════════════════════════
// CONVERT Gemini Response → OpenAI InvokeResult
// ═══════════════════════════════════════════════

function convertGeminiResultToInvokeResult(result: GenerateContentResult): InvokeResult {
  const response = result.response;
  const candidate = response.candidates?.[0];

  if (!candidate) {
    return {
      id: `gemini-${Date.now()}`,
      created: Math.floor(Date.now() / 1000),
      model: "gemini-2.5-flash",
      choices: [],
    };
  }

  const parts = candidate.content?.parts || [];

  // Check for function calls
  const functionCalls: FunctionCall[] = [];
  let textContent = "";

  for (const part of parts) {
    if ("functionCall" in part && part.functionCall) {
      functionCalls.push(part.functionCall);
    }
    if ("text" in part && part.text) {
      textContent += part.text;
    }
  }

  const toolCalls: ToolCall[] = functionCalls.map((fc, i) => ({
    id: `call_${Date.now()}_${i}`,
    type: "function" as const,
    function: {
      name: fc.name,
      arguments: JSON.stringify(fc.args || {}),
    },
  }));

  return {
    id: `gemini-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: "gemini-2.5-flash",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: textContent,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
    }],
    usage: response.usageMetadata ? {
      prompt_tokens: response.usageMetadata.promptTokenCount || 0,
      completion_tokens: response.usageMetadata.candidatesTokenCount || 0,
      total_tokens: response.usageMetadata.totalTokenCount || 0,
    } : undefined,
  };
}

// ═══════════════════════════════════════════════
// PUBLIC API — drop-in replacement for invokeLLM
// ═══════════════════════════════════════════════

export interface GeminiInvokeParams {
  messages: Message[];
  tools?: Tool[];
  tool_choice?: "none" | "auto" | string;
  response_format?: {
    type: string;
    json_schema?: {
      name: string;
      strict?: boolean;
      schema: Record<string, unknown>;
    };
  };
  /** Tracking context for usage logging */
  _tracking?: {
    accountId?: number;
    userId?: number;
    endpoint: string;
  };
}

export async function invokeGemini(params: GeminiInvokeParams): Promise<InvokeResult> {
  const genAI = getGenAI();

  const { systemInstruction, contents } = convertMessagesToGemini(params.messages);

  // Build model config
  const modelConfig: any = {
    model: "gemini-2.5-flash",
  };

  if (systemInstruction) {
    modelConfig.systemInstruction = systemInstruction;
  }

  // Add tools if provided and tool_choice is not "none"
  if (params.tools && params.tools.length > 0 && params.tool_choice !== "none") {
    modelConfig.tools = convertToolsToGemini(params.tools);
  }

  // Handle response format (JSON mode)
  if (params.response_format?.type === "json_schema" || params.response_format?.type === "json_object") {
    modelConfig.generationConfig = {
      responseMimeType: "application/json",
    };
    if (params.response_format.json_schema?.schema) {
      modelConfig.generationConfig.responseSchema = sanitizeSchemaForGemini(
        params.response_format.json_schema.schema
      );
    }
  }

  const model = genAI.getGenerativeModel(modelConfig);

  // Ensure contents is not empty
  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: "Hello" }] });
  }

  const startTime = Date.now();
  try {
    const result = await model.generateContent({ contents });
    const invokeResult = convertGeminiResultToInvokeResult(result);

    // Log successful usage
    const usage = invokeResult.usage;
    if (params._tracking) {
      const promptTokens = usage?.prompt_tokens ?? 0;
      const completionTokens = usage?.completion_tokens ?? 0;
      const totalTokens = usage?.total_tokens ?? 0;
      // Gemini 2.5 Flash pricing: $0.15/1M input, $0.60/1M output (as of 2025)
      const costUsd = (promptTokens * 0.00000015) + (completionTokens * 0.0000006);
      logGeminiUsage({
        accountId: params._tracking.accountId ?? null,
        userId: params._tracking.userId ?? null,
        endpoint: params._tracking.endpoint,
        model: "gemini-2.5-flash",
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: costUsd.toFixed(6),
        success: true,
        durationMs: Date.now() - startTime,
      });
    }

    return invokeResult;
  } catch (err: any) {
    // Log failed usage
    if (params._tracking) {
      logGeminiUsage({
        accountId: params._tracking.accountId ?? null,
        userId: params._tracking.userId ?? null,
        endpoint: params._tracking.endpoint,
        model: "gemini-2.5-flash",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: "0",
        success: false,
        errorMessage: err.message || String(err),
        durationMs: Date.now() - startTime,
      });
    }
    console.error("[Jarvis] Gemini API error:", err.message || err);
    throw new Error(`Gemini API call failed: ${err.message || String(err)}`);
  }
}

/**
 * Invoke Gemini with a specific model override.
 */
async function invokeGeminiWithModel(params: GeminiInvokeParams, modelName: string): Promise<InvokeResult> {
  const genAI = getGenAI();
  const { systemInstruction, contents } = convertMessagesToGemini(params.messages);

  const modelConfig: any = { model: modelName };
  if (systemInstruction) modelConfig.systemInstruction = systemInstruction;
  if (params.tools && params.tools.length > 0 && params.tool_choice !== "none") {
    modelConfig.tools = convertToolsToGemini(params.tools);
  }
  if (params.response_format?.type === "json_schema" || params.response_format?.type === "json_object") {
    modelConfig.generationConfig = { responseMimeType: "application/json" };
    if (params.response_format.json_schema?.schema) {
      modelConfig.generationConfig.responseSchema = sanitizeSchemaForGemini(
        params.response_format.json_schema.schema
      );
    }
  }

  const model = genAI.getGenerativeModel(modelConfig);
  const safeContents = contents.length === 0
    ? [{ role: "user" as const, parts: [{ text: "Hello" }] }]
    : contents;

  const result = await model.generateContent({ contents: safeContents });
  return convertGeminiResultToInvokeResult(result);
}

/**
 * Check if an error is a 503 / overloaded / quota error that warrants fallback.
 */
function isOverloadedError(err: any): boolean {
  const msg = (err?.message || String(err)).toLowerCase();
  return msg.includes("503") || msg.includes("overloaded") || msg.includes("high demand") || msg.includes("resource exhausted") || msg.includes("429");
}

/**
 * Invoke Gemini with retry, model fallback chain, and built-in LLM fallback.
 *
 * Fallback chain:
 *   1. gemini-2.5-flash (primary)
 *   2. gemini-2.0-flash (fallback on 503)
 *   3. Built-in invokeLLM via platform (last resort on 503)
 */
export async function invokeGeminiWithRetry(params: GeminiInvokeParams): Promise<InvokeResult> {
  const TIMEOUT_MS = 45_000;

  const callWithTimeout = (modelName: string) => {
    return Promise.race([
      invokeGeminiWithModel(params, modelName),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini request timed out after ${TIMEOUT_MS / 1000}s (model: ${modelName})`)), TIMEOUT_MS)
      ),
    ]);
  };

  const startTime = Date.now();

  // Attempt 1: gemini-2.5-flash
  try {
    const result = await callWithTimeout("gemini-2.5-flash");
    // Log success
    if (params._tracking) {
      const usage = result.usage;
      logGeminiUsage({
        accountId: params._tracking.accountId ?? null,
        userId: params._tracking.userId ?? null,
        endpoint: params._tracking.endpoint,
        model: "gemini-2.5-flash",
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
        estimatedCostUsd: "0",
        success: true,
        durationMs: Date.now() - startTime,
      });
    }
    return result;
  } catch (err: any) {
    console.warn("[Jarvis] gemini-2.5-flash failed:", err.message);

    if (!isOverloadedError(err)) {
      // Non-overload error — retry once with same model
      try {
        await new Promise(r => setTimeout(r, 2000));
        return await callWithTimeout("gemini-2.5-flash");
      } catch (retryErr: any) {
        console.error("[Jarvis] gemini-2.5-flash retry also failed:", retryErr.message);
        throw retryErr;
      }
    }
  }

  // Attempt 2: gemini-2.0-flash (fallback for overload)
  try {
    console.log("[Jarvis] Falling back to gemini-2.0-flash...");
    const result = await callWithTimeout("gemini-2.0-flash");
    if (params._tracking) {
      logGeminiUsage({
        accountId: params._tracking.accountId ?? null,
        userId: params._tracking.userId ?? null,
        endpoint: params._tracking.endpoint,
        model: "gemini-2.0-flash (fallback)",
        promptTokens: result.usage?.prompt_tokens ?? 0,
        completionTokens: result.usage?.completion_tokens ?? 0,
        totalTokens: result.usage?.total_tokens ?? 0,
        estimatedCostUsd: "0",
        success: true,
        durationMs: Date.now() - startTime,
      });
    }
    return result;
  } catch (err2: any) {
    console.warn("[Jarvis] gemini-2.0-flash also failed:", err2.message);
  }

  // Attempt 3: Built-in platform LLM (last resort)
  try {
    console.log("[Jarvis] Falling back to built-in platform LLM...");
    const { invokeLLM } = await import("../_core/llm");
    const result = await invokeLLM({
      messages: params.messages,
      tools: params.tools,
      tool_choice: params.tool_choice as any,
      response_format: params.response_format as any,
    });
    if (params._tracking) {
      logGeminiUsage({
        accountId: params._tracking.accountId ?? null,
        userId: params._tracking.userId ?? null,
        endpoint: params._tracking.endpoint,
        model: "platform-llm (fallback)",
        promptTokens: result.usage?.prompt_tokens ?? 0,
        completionTokens: result.usage?.completion_tokens ?? 0,
        totalTokens: result.usage?.total_tokens ?? 0,
        estimatedCostUsd: "0",
        success: true,
        durationMs: Date.now() - startTime,
      });
    }
    return result;
  } catch (err3: any) {
    console.error("[Jarvis] All LLM fallbacks exhausted:", err3.message);
    if (params._tracking) {
      logGeminiUsage({
        accountId: params._tracking.accountId ?? null,
        userId: params._tracking.userId ?? null,
        endpoint: params._tracking.endpoint,
        model: "all-fallbacks-failed",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: "0",
        success: false,
        errorMessage: err3.message || String(err3),
        durationMs: Date.now() - startTime,
      });
    }
    throw new Error(`All LLM providers failed. Last error: ${err3.message}`);
  }
}
