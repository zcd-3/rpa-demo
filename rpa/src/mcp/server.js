import path from "node:path";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { captureFailureArtifacts } from "../artifacts.js";
import { closeBrowserSession, getBrowserSession } from "../browser.js";
import { serializeError } from "../errors.js";
import { createTaskId } from "../reliability.js";
import { executeTool } from "../toolRegistry.js";
import { mcpToolDefinitions } from "./toolDefinitions.js";

function withTaskId(taskId, result) {
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return { taskId, ...result };
  }
  return { taskId, result };
}

function asMcpResult(payload, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    ...(isError ? { isError: true } : {}),
  };
}

export function createRpaMcpServer({
  acquireBrowser = getBrowserSession,
  execute = executeTool,
  captureFailure = captureFailureArtifacts,
} = {}) {
  const server = new McpServer(
    { name: "local-seller-rpa", version: "0.1.0" },
    {
      instructions: [
        "使用这些工具查询或操作本地卖家平台。",
        "修改价格、库存或上下架状态前，必须先向用户确认具体 SKU 和目标值。",
        "工具调用共用一个浏览器会话，服务会自动串行执行。",
      ].join("\n"),
    },
  );

  let executionQueue = Promise.resolve();
  const runExclusive = (operation) => {
    const current = executionQueue.then(operation, operation);
    executionQueue = current.catch(() => {});
    return current;
  };

  for (const definition of mcpToolDefinitions) {
    server.registerTool(
      definition.name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.inputSchema,
        annotations: definition.annotations,
      },
      (args) => runExclusive(async () => {
        const taskId = createTaskId("mcp");
        let page;
        try {
          ({ page } = await acquireBrowser());
          const result = await execute(definition.name, { ...args, page, taskId });
          return asMcpResult(withTaskId(taskId, result));
        } catch (error) {
          const artifactPath = await captureFailure({
            page,
            error,
            taskId,
            metadata: { transport: "stdio", tool: definition.name },
          });
          return asMcpResult({ taskId, ...serializeError(error), artifactPath }, true);
        }
      }),
    );
  }

  return server;
}

export async function startMcpServer() {
  const server = createRpaMcpServer();
  const transport = new StdioServerTransport();
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await Promise.allSettled([server.close(), closeBrowserSession()]);
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
  process.stdin.once("end", () => void closeBrowserSession());
  await server.connect(transport);
  return server;
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (entryPath === import.meta.url) {
  startMcpServer().catch((error) => {
    console.error(`[rpa-mcp] ${error instanceof Error ? error.stack || error.message : String(error)}`);
    process.exitCode = 1;
  });
}
