import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { RpaError } from "../src/errors.js";
import { createRpaMcpServer } from "../src/mcp/server.js";

async function createTestPair(overrides = {}) {
  const server = createRpaMcpServer({
    acquireBrowser: async () => ({ page: { testPage: true } }),
    captureFailure: async () => "test-artifacts/mcp",
    ...overrides,
  });
  const client = new Client({ name: "rpa-mcp-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

test("MCP 会列出全部 RPA 工具和读写提示", async () => {
  const { client, server } = await createTestPair({ execute: async () => ({ success: true }) });
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name), [
      "login",
      "openRefundOrders",
      "queryProduct",
      "updateProductPrice",
      "updateProductStock",
      "activateProduct",
      "deactivateProduct",
      "downloadReport",
    ]);
    assert.equal(tools.find((tool) => tool.name === "queryProduct").annotations.readOnlyHint, true);
    assert.equal(tools.find((tool) => tool.name === "updateProductPrice").annotations.readOnlyHint, false);
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
});

test("MCP 调用复用执行层并返回 taskId 和结构化结果", async () => {
  let received;
  const { client, server } = await createTestPair({
    execute: async (name, args) => {
      received = { name, args };
      return { success: true, products: [{ sku: "SKU-1" }] };
    },
  });
  try {
    const result = await client.callTool({ name: "queryProduct", arguments: { query: "SKU-1" } });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent.success, true);
    assert.match(result.structuredContent.taskId, /^mcp-/);
    assert.deepEqual(result.structuredContent.products, [{ sku: "SKU-1" }]);
    assert.equal(received.name, "queryProduct");
    assert.equal(received.args.query, "SKU-1");
    assert.equal(received.args.page.testPage, true);
    assert.equal(received.args.taskId, result.structuredContent.taskId);
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
});

test("MCP 将 RPA 故障转换为 agent 可见的结构化工具错误", async () => {
  const { client, server } = await createTestPair({
    execute: async () => {
      throw new RpaError("PRODUCT_NOT_FOUND", "商品不存在");
    },
  });
  try {
    const result = await client.callTool({ name: "queryProduct", arguments: { query: "missing" } });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.code, "PRODUCT_NOT_FOUND");
    assert.equal(result.structuredContent.error, "商品不存在");
    assert.equal(result.structuredContent.artifactPath, "test-artifacts/mcp");
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
});

test("MCP 在启动浏览器前拒绝非法写入参数", async () => {
  let browserStarts = 0;
  const { client, server } = await createTestPair({
    acquireBrowser: async () => {
      browserStarts += 1;
      return { page: {} };
    },
    execute: async () => ({ success: true }),
  });
  try {
    const result = await client.callTool({
      name: "updateProductStock",
      arguments: { sku: "SKU-1", stock: -1 },
    });
    assert.equal(result.isError, true);
    assert.equal(browserStarts, 0);
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
});

test("stdio 入口可由本地 MCP client 启动并完成握手", async () => {
  const client = new Client({ name: "rpa-stdio-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve("src/mcp/server.js")],
    cwd: process.cwd(),
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.equal(tools.length, 8);
    assert.equal(tools.some((tool) => tool.name === "queryProduct"), true);
  } finally {
    await client.close();
  }
});
