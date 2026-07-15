import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(rootDir, ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

export const config = {
  rootDir,
  baseUrl: process.env.BASE_URL || "http://localhost:3000",
  email: process.env.SELLER_EMAIL || "seller@example.com",
  password: process.env.SELLER_PASSWORD || "demo123",
  headless: process.env.HEADLESS !== "false",
  browserChannel: process.env.BROWSER_CHANNEL || "msedge",
  timeout: Number(process.env.ACTION_TIMEOUT_MS || 15000),
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  deepseekModel: process.env.DEEPSEEK_MODEL || "deepseek-v4-pro",
  userDataDir: path.join(rootDir, "playwright", ".profile"),
  downloadsDir: path.join(rootDir, "downloads"),
};
