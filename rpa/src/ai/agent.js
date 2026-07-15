import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { getBrowserSession, closeBrowserSession } from "../browser.js";
import { config } from "../config.js";
import { executeTool } from "../toolRegistry.js";
import { toolDefinitions } from "./toolDefinitions.js";

const tools = toolDefinitions.map((definition) => ({
  type: "function",
  function: definition,
}));

function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /password|token|secret|api.?key|authorization/i.test(key) ? "[已隐藏]" : redactSensitive(item),
  ]));
}

function verboseLog(enabled, label, value) {
  if (!enabled) return;
  const detail = value === undefined ? "" : `: ${JSON.stringify(redactSensitive(value))}`;
  console.error(`[verbose] ${label}${detail}`);
}

async function createChatCompletion(messages) {
  if (!config.deepseekApiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY，请先在 rpa/.env 中配置");
  }
  const url = `${config.deepseekBaseUrl.replace(/\/+$/, "")}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.deepseekApiKey}`,
    },
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
    throw new Error(`DeepSeek API 请求失败（${response.status}）：${detail}`);
  }
  const message = body.choices?.[0]?.message;
  if (!message) throw new Error("DeepSeek API 没有返回有效消息");
  return message;
}

export async function runAgentToolCall({ name, arguments: args = {} }, runtime) {
  return executeTool(name, { ...args, ...runtime });
}

export async function runAgent(prompt, { verbose = false } = {}) {
  if (!prompt?.trim()) throw new Error("请输入要交给 AI 的任务");
  const messages = [
    {
      role: "system",
      content: [
        "你是卖家平台操作助手。需要读取或操作平台时必须调用提供的工具，并根据工具返回的结构化数据用中文简洁回答。",
        "回答会直接显示在 Windows 终端中，必须输出纯文本，不要使用 Markdown。",
        "禁止使用 Markdown 标题、粗体标记、表格、代码围栏、链接语法、分隔线和 emoji。",
        "需要分项时只使用普通数字编号或短横线；字段使用“名称: 值”的形式。",
        "你只能调用当前提供的工具，只能执行这些工具明确支持的操作和参数。",
        "禁止执行或建议自己执行任意系统命令、任意文件读写、复制、移动、删除或访问工具能力之外的路径。",
        "如果用户要求的部分能力没有对应工具，例如要求把下载文件复制到桌面，必须明确说明该部分不受支持；可以继续执行其余受支持部分，但要准确说明实际结果和保存位置。",
        "不得虚构工具、不得自行扩大权限，也不要声称执行了未调用或执行失败的操作。",
      ].join("\n"),
    },
    { role: "user", content: prompt.trim() },
  ];
  let browserStarted = false;

  try {
    for (let round = 0; round < 8; round += 1) {
      const aiStartedAt = Date.now();
      verboseLog(verbose, `DeepSeek 请求第 ${round + 1} 轮`, { model: config.deepseekModel });
      const message = await createChatCompletion(messages);
      verboseLog(verbose, "DeepSeek 响应", {
        durationMs: Date.now() - aiStartedAt,
        toolCalls: message.tool_calls?.length || 0,
      });
      messages.push(message);
      if (!message.tool_calls?.length) {
        return message.content || "任务已完成。";
      }

      if (!browserStarted) {
        await getBrowserSession();
        browserStarted = true;
      }
      const { page } = await getBrowserSession();
      for (const call of message.tool_calls) {
        let result;
        const toolStartedAt = Date.now();
        try {
          const args = JSON.parse(call.function.arguments || "{}");
          verboseLog(verbose, `调用工具 ${call.function.name}`, { arguments: args });
          result = await runAgentToolCall(
            { name: call.function.name, arguments: args },
            { page },
          );
        } catch (error) {
          result = { success: false, error: error.message };
        }
        verboseLog(verbose, `工具完成 ${call.function.name}`, {
          success: result?.success === true,
          durationMs: Date.now() - toolStartedAt,
          error: result?.error,
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }
    throw new Error("AI 工具调用轮次超过上限");
  } finally {
    if (browserStarted) await closeBrowserSession();
  }
}

async function main() {
  const cliArguments = process.argv.slice(2);
  const verbose = cliArguments.includes("--verbose") || cliArguments.includes("-v");
  let prompt = cliArguments.filter((value) => value !== "--verbose" && value !== "-v").join(" ").trim();
  if (!prompt) {
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    try {
      prompt = (await readline.question("请输入要交给 AI 的任务：")).trim();
    } finally {
      readline.close();
    }
  }
  try {
    const answer = await runAgent(prompt, { verbose });
    console.log(answer);
  } catch (error) {
    console.error(JSON.stringify({ success: false, error: error.message }, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
