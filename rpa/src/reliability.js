import { RpaError, toRpaError } from "./errors.js";

export async function withRetry(operation, {
  attempts = 2,
  delayMs = 500,
  shouldRetry = (error) => toRpaError(error).retryable,
  onRetry,
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error)) throw error;
      await onRetry?.(error, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastError;
}

export function createTaskId(prefix = "task") {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  return `${prefix}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function assertWithinBudget(current, limit, label) {
  if (current <= limit) return;
  throw new RpaError("AGENT_BUDGET_EXCEEDED", `${label}超过上限（${limit}）`, {
    details: { current, limit, label },
  });
}
