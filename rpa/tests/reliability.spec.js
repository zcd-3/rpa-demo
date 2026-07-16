// @ts-check
import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { captureFailureArtifacts } from "../src/artifacts.js";
import { AgentConversation, runAgent } from "../src/ai/agent.js";
import { config, createConfig } from "../src/config.js";
import { RpaError, serializeError } from "../src/errors.js";
import { stableStringify, withRetry } from "../src/reliability.js";
import { validateToolArguments } from "../src/toolRegistry.js";

test("配置加载会拒绝无效超时、布尔值和非 HTTPS AI 地址", () => {
  expect(() => createConfig({ ACTION_TIMEOUT_MS: "abc" })).toThrow("ACTION_TIMEOUT_MS 必须是正整数");
  expect(() => createConfig({ HEADLESS: "sometimes" })).toThrow("HEADLESS 只能是 true 或 false");
  expect(() => createConfig({ DEEPSEEK_BASE_URL: "http://api.example.com" })).toThrow("必须使用 HTTPS URL");
});

test("统一工具校验会拒绝未知参数和非法写入值", () => {
  expect(() => validateToolArguments("queryProduct", {})).not.toThrow();
  expect(() => validateToolArguments("queryProduct", { query: "", status: "已下架" })).not.toThrow();
  expect(() => validateToolArguments("queryProduct", { status: "停售" })).toThrow("可选值：全部、已上架、已下架");
  expect(() => validateToolArguments("updateProductPrice", { sku: "SKU-1", price: -1 })).toThrow("price 必须是非负数字");
  expect(() => validateToolArguments("queryProduct", { query: "USB", command: "whoami" })).toThrow("不支持参数“command”");
});

test("有限重试只重试标记为可恢复的错误", async () => {
  let attempts = 0;
  const result = await withRetry(async () => {
    attempts += 1;
    if (attempts === 1) throw new RpaError("TEMPORARY", "短暂失败", { retryable: true });
    return "ok";
  }, { attempts: 2, delayMs: 1 });

  expect(result).toBe("ok");
  expect(attempts).toBe(2);
});

test("不可恢复错误会保留结构化错误码且不会重试", async () => {
  let attempts = 0;
  const error = new RpaError("INVALID_TOOL_ARGUMENTS", "参数错误");
  await expect(withRetry(async () => {
    attempts += 1;
    throw error;
  }, { attempts: 3, delayMs: 1 })).rejects.toBe(error);

  expect(attempts).toBe(1);
  expect(serializeError(error)).toMatchObject({ code: "INVALID_TOOL_ARGUMENTS", retryable: false });
});

test("稳定序列化不会因参数键顺序不同而改变幂等指纹", () => {
  expect(stableStringify({ sku: "A", price: 10 })).toBe(stableStringify({ price: 10, sku: "A" }));
});

test("任务失败会写入带错误码的结构化诊断文件", async () => {
  const taskId = `test-artifact-${Date.now()}`;
  const directory = await captureFailureArtifacts({
    taskId,
    error: new RpaError("TEST_FAILURE", "测试故障"),
    metadata: { tool: "test" },
  });
  expect(directory).toBeTruthy();
  try {
    const diagnostic = JSON.parse(await fs.readFile(`${directory}/result.json`, "utf8"));
    expect(diagnostic).toMatchObject({ taskId, code: "TEST_FAILURE", error: "测试故障" });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("AI 写操作未确认时不会启动浏览器或执行工具", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = config.deepseekApiKey;
  let apiCalls = 0;
  let confirmations = 0;
  config.deepseekApiKey = "test-key";
  globalThis.fetch = async () => {
    apiCalls += 1;
    const message = apiCalls === 1
      ? {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "call-1", type: "function", function: { name: "updateProductPrice", arguments: '{"sku":"WBH-2026-BLK","price":89.99}' } }],
        }
      : { role: "assistant", content: "写操作未确认，因此没有执行。" };
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
    };
  };

  try {
    const answer = await runAgent("修改价格", {
      confirmWrite: async () => {
        confirmations += 1;
        return false;
      },
    });
    expect(answer).toContain("没有执行");
    expect(confirmations).toBe(1);
    expect(apiCalls).toBe(2);
  } finally {
    config.deepseekApiKey = originalKey;
    globalThis.fetch = originalFetch;
  }
});

test("多轮 Agent 会把上一轮用户和 AI 回答发送到下一轮", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = config.deepseekApiKey;
  const requestMessages = [];
  let apiCalls = 0;
  config.deepseekApiKey = "test-key";
  globalThis.fetch = async (_url, options) => {
    apiCalls += 1;
    requestMessages.push(JSON.parse(String(options?.body)).messages);
    const content = apiCalls === 1 ? "商品 WBH-2026-BLK 的库存是 86。" : "已根据上一轮商品继续回答。";
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { role: "assistant", content } }] }),
    };
  };

  try {
    const conversation = new AgentConversation();
    await runAgent("查询 WBH-2026-BLK", { conversation });
    await runAgent("它的库存是多少？", { conversation });

    const secondRequest = requestMessages[1];
    expect(secondRequest).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "user", content: "查询 WBH-2026-BLK" }),
      expect.objectContaining({ role: "assistant", content: "商品 WBH-2026-BLK 的库存是 86。" }),
      expect.objectContaining({ role: "user", content: "它的库存是多少？" }),
    ]));
    expect(conversation.getHistory()).toHaveLength(2);
  } finally {
    config.deepseekApiKey = originalKey;
    globalThis.fetch = originalFetch;
  }
});

test("上下文超过轮数限制时会删除完整的最旧轮次", () => {
  const conversation = new AgentConversation({ maxTurns: 2, maxChars: 10000 });
  conversation.addTurn([{ role: "user", content: "第一轮" }, { role: "assistant", content: "回答一" }]);
  conversation.addTurn([{ role: "user", content: "第二轮" }, { role: "assistant", content: "回答二" }]);
  conversation.addTurn([{ role: "user", content: "第三轮" }, { role: "assistant", content: "回答三" }]);

  const messages = conversation.getMessages();
  expect(messages.some((message) => message.content === "第一轮")).toBe(false);
  expect(messages.some((message) => message.content === "第二轮")).toBe(true);
  expect(messages.some((message) => message.content === "第三轮")).toBe(true);
});

test("AI 可以在用户明确告别时结束整个会话", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = config.deepseekApiKey;
  let apiCalls = 0;
  config.deepseekApiKey = "test-key";
  globalThis.fetch = async () => {
    apiCalls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "end-1",
              type: "function",
              function: { name: "endConversation", arguments: '{"message":"好，今天先到这里。需要时再找我。"}' },
            }],
          },
        }],
      }),
    };
  };

  try {
    const conversation = new AgentConversation();
    const answer = await runAgent("先这样吧，再见", { conversation, keepBrowser: true });
    expect(answer).toBe("好，今天先到这里。需要时再找我。");
    expect(conversation.closed).toBe(true);
    expect(conversation.closingMessage).toBe(answer);
    expect(conversation.getHistory()[0].assistant).toBe(answer);
    expect(apiCalls).toBe(1);
  } finally {
    config.deepseekApiKey = originalKey;
    globalThis.fetch = originalFetch;
  }
});

test("用户确认已记录的写操作后不会再次弹出终端确认", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = config.deepseekApiKey;
  let apiCalls = 0;
  let terminalConfirmations = 0;
  let executedWrites = 0;
  config.deepseekApiKey = "test-key";
  globalThis.fetch = async () => {
    apiCalls += 1;
    const messages = {
      1: {
        role: "assistant",
        content: null,
        tool_calls: [{
          id: "confirm-1",
          type: "function",
          function: {
            name: "requestWriteConfirmation",
            arguments: JSON.stringify({
              name: "updateProductPrice",
              arguments: { sku: "HUB-7IN1-GRY", price: 10 },
              message: "确认执行 updateProductPrice 吗？",
            }),
          },
        }],
      },
      2: {
        role: "assistant",
        content: null,
        tool_calls: [{
          id: "write-1",
          type: "function",
          function: { name: "updateProductPrice", arguments: '{"sku":"HUB-7IN1-GRY","price":10}' },
        }],
      },
      3: { role: "assistant", content: "价格已更新为 10 美元。" },
    };
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: messages[apiCalls] }] }),
    };
  };

  try {
    const conversation = new AgentConversation();
    const confirmQuestion = await runAgent("把 USB 商品价格改为 10 美元", { conversation });
    expect(confirmQuestion).toBe("确认将商品 HUB-7IN1-GRY 的价格修改为 10 美元吗？");
    expect(confirmQuestion).not.toContain("updateProductPrice");

    const answer = await runAgent("是的", {
      conversation,
      confirmWrite: async () => {
        terminalConfirmations += 1;
        return true;
      },
      executeToolCall: async ({ name, arguments: args }) => {
        executedWrites += 1;
        expect(name).toBe("updateProductPrice");
        expect(args).toEqual({ sku: "HUB-7IN1-GRY", price: 10 });
        return { success: true };
      },
    });

    expect(answer).toBe("价格已更新为 10 美元。");
    expect(terminalConfirmations).toBe(0);
    expect(executedWrites).toBe(1);
    expect(apiCalls).toBe(3);
  } finally {
    config.deepseekApiKey = originalKey;
    globalThis.fetch = originalFetch;
  }
});
