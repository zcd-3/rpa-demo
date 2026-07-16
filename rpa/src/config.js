import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(rootDir, ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

function parsePositiveInteger(name, value, fallback) {
  const raw = value || String(fallback);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`配置错误：${name} 必须是正整数，当前值为“${raw}”`);
  }
  return parsed;
}

function parseNonNegativeInteger(name, value, fallback) {
  const raw = value ?? String(fallback);
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`配置错误：${name} 必须是非负整数，当前值为“${raw}”`);
  }
  return parsed;
}

function parseBoolean(name, value, fallback) {
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`配置错误：${name} 只能是 true 或 false，当前值为“${value}”`);
}

function parseUrl(name, value, fallback, { httpsOnly = false } = {}) {
  const raw = value || fallback;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`配置错误：${name} 不是有效 URL，当前值为“${raw}”`);
  }
  if (!["http:", "https:"].includes(url.protocol) || (httpsOnly && url.protocol !== "https:")) {
    throw new Error(`配置错误：${name} 必须使用${httpsOnly ? " HTTPS" : " HTTP 或 HTTPS"} URL`);
  }
  return raw.replace(/\/+$/, "");
}

export function createConfig(environment = process.env) {
  const deepseekModel = environment.DEEPSEEK_MODEL || "deepseek-v4-pro";
  if (!deepseekModel.trim()) throw new Error("配置错误：DEEPSEEK_MODEL 不能为空");
  return {
    rootDir,
    baseUrl: parseUrl("BASE_URL", environment.BASE_URL, "http://localhost:3000"),
    email: environment.SELLER_EMAIL || "seller@example.com",
    password: environment.SELLER_PASSWORD || "demo123",
    headless: parseBoolean("HEADLESS", environment.HEADLESS, true),
    browserChannel: environment.BROWSER_CHANNEL || "msedge",
    timeout: parsePositiveInteger("ACTION_TIMEOUT_MS", environment.ACTION_TIMEOUT_MS, 15000),
    retryAttempts: parsePositiveInteger("RPA_RETRY_ATTEMPTS", environment.RPA_RETRY_ATTEMPTS, 2),
    retryDelayMs: parsePositiveInteger("RPA_RETRY_DELAY_MS", environment.RPA_RETRY_DELAY_MS, 500),
    deepseekApiKey: environment.DEEPSEEK_API_KEY || "",
    deepseekBaseUrl: parseUrl("DEEPSEEK_BASE_URL", environment.DEEPSEEK_BASE_URL, "https://api.deepseek.com", { httpsOnly: true }),
    deepseekModel,
    aiRequestTimeoutMs: parsePositiveInteger("AI_REQUEST_TIMEOUT_MS", environment.AI_REQUEST_TIMEOUT_MS, 30000),
    aiMaxRetries: parseNonNegativeInteger("AI_MAX_RETRIES", environment.AI_MAX_RETRIES, 2),
    aiMaxRounds: parsePositiveInteger("AI_MAX_ROUNDS", environment.AI_MAX_ROUNDS, 8),
    aiMaxContextTurns: parsePositiveInteger("AI_MAX_CONTEXT_TURNS", environment.AI_MAX_CONTEXT_TURNS, 8),
    aiMaxContextChars: parsePositiveInteger("AI_MAX_CONTEXT_CHARS", environment.AI_MAX_CONTEXT_CHARS, 60000),
    aiMaxToolCalls: parsePositiveInteger("AI_MAX_TOOL_CALLS", environment.AI_MAX_TOOL_CALLS, 12),
    aiMaxWriteOperations: parsePositiveInteger("AI_MAX_WRITE_OPERATIONS", environment.AI_MAX_WRITE_OPERATIONS, 3),
    aiRequireWriteConfirmation: parseBoolean("AI_REQUIRE_WRITE_CONFIRMATION", environment.AI_REQUIRE_WRITE_CONFIRMATION, true),
    userDataDir: path.join(rootDir, "playwright", ".profile"),
    downloadsDir: path.join(rootDir, "downloads"),
    artifactsDir: path.join(rootDir, "artifacts"),
  };
}

export const config = createConfig();
