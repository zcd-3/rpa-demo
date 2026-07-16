import { config } from "../config.js";
import { RpaError, toRpaError } from "../errors.js";
import { withRetry } from "../reliability.js";
import { toolDefinitions } from "./toolDefinitions.js";

const tools = toolDefinitions.map((definition) => ({
  type: "function",
  function: definition,
}));

export async function createChatCompletion(messages, { onRetry } = {}) {
  if (!config.deepseekApiKey) {
    throw new RpaError("AI_API_KEY_MISSING", "缺少 DEEPSEEK_API_KEY，请先在 rpa/.env 中配置");
  }
  const url = `${config.deepseekBaseUrl.replace(/\/+$/, "")}/chat/completions`;
  return withRetry(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.aiRequestTimeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.deepseekApiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.deepseekModel,
          messages,
          tools,
          tool_choice: "auto",
          stream: false,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = body.error?.message || JSON.stringify(body);
        const retryable = response.status === 429 || response.status >= 500;
        throw new RpaError(
          response.status === 401 ? "AI_AUTH_FAILED" : "AI_REQUEST_FAILED",
          `DeepSeek API 请求失败（${response.status}）：${detail}`,
          { retryable, details: { status: response.status } },
        );
      }
      const message = body.choices?.[0]?.message;
      if (!message) throw new RpaError("AI_INVALID_RESPONSE", "DeepSeek API 没有返回有效消息", { retryable: true });
      return { message, usage: body.usage || null };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new RpaError("AI_REQUEST_TIMEOUT", `DeepSeek API 请求超过 ${config.aiRequestTimeoutMs}ms`, { retryable: true, cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }, {
    attempts: config.aiMaxRetries + 1,
    delayMs: 1000,
    shouldRetry: (error) => toRpaError(error).retryable,
    onRetry,
  });
}
