import { getBrowserSession, closeBrowserSession } from "./browser.js";
import { executeTool, listTools } from "./toolRegistry.js";

function printUsage() {
  console.log("用法：node src/main.js <任务名> [key=value ...]");
  console.log(`任务：${listTools().join(", ")}`);
  console.log("CMD 示例：node src/main.js queryProduct query=WBH-2026-BLK");
  console.log("也兼容 JSON：node src/main.js queryProduct '{\"query\":\"WBH-2026-BLK\"}'");
}

const [name, ...argumentParts] = process.argv.slice(2);
if (!name || name === "list") {
  printUsage();
  process.exit(0);
}

function parseValue(value) {
  const clean = value.trim().replace(/^['"]|['"]$/g, "");
  if (clean === "true") return true;
  if (clean === "false") return false;
  if (clean === "null") return null;
  if (clean !== "" && Number.isFinite(Number(clean))) return Number(clean);
  return clean;
}

function parseArguments(parts) {
  if (parts.length === 0) return {};
  let raw = parts.join(" ").trim();
  if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1);
  try {
    return JSON.parse(raw);
  } catch {
    const body = raw.startsWith("{") && raw.endsWith("}") ? raw.slice(1, -1) : raw;
    const entries = body.includes("=") ? parts : body.split(",");
    const result = {};
    for (const entry of entries) {
      const separator = entry.includes("=") ? "=" : ":";
      const index = entry.indexOf(separator);
      if (index < 1) throw new Error(`无法解析参数：${entry}`);
      const key = entry.slice(0, index).trim().replace(/^['"]|['"]$/g, "");
      result[key] = parseValue(entry.slice(index + 1));
    }
    return result;
  }
}

let args;
try {
  args = parseArguments(argumentParts);
} catch (error) {
  console.error(`参数解析失败：${error.message}`);
  console.error("Windows CMD 推荐写法：query=值");
  process.exit(1);
}

try {
  const { page } = await getBrowserSession();
  const result = await executeTool(name, { ...args, page });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ success: false, error: error.message }, null, 2));
  process.exitCode = 1;
} finally {
  await closeBrowserSession();
}
