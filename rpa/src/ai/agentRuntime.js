import { captureFailureArtifacts } from "../artifacts.js";
import { getBrowserSession, closeBrowserSession, resetBrowserSession } from "../browser.js";
import { config } from "../config.js";
import { RpaError, serializeError, toRpaError } from "../errors.js";
import { assertWithinBudget, createTaskId, stableStringify, withRetry } from "../reliability.js";
import { executeTool, validateToolArguments } from "../toolRegistry.js";
import { AgentConversation } from "./conversation.js";
import { createChatCompletion } from "./deepseekClient.js";
import { describeWriteOperation, verboseLog } from "./presentation.js";

const writeTools = new Set(["updateProductPrice", "updateProductStock", "activateProduct", "deactivateProduct"]);
const recoverableReadTools = new Set(["login", "queryProduct", "openRefundOrders"]);

export async function runAgentToolCall({ name, arguments: args = {} }, runtime) {
  return executeTool(name, { ...args, ...runtime });
}

function createSystemMessage(hasConversation) {
  return {
    role: "system",
    content: [
      "你是卖家平台操作助手。需要读取或操作平台时必须调用提供的工具，并根据工具返回的结构化数据用中文简洁回答。",
      "回答会直接显示在 Windows 终端中，必须输出纯文本，不要使用 Markdown。",
      "禁止使用 Markdown 标题、粗体标记、表格、代码围栏、链接语法、分隔线和 emoji。",
      "需要分项时只使用普通数字编号或短横线；字段使用“名称: 值”的形式。",
      "你只能调用当前提供的工具，只能执行这些工具明确支持的操作和参数。",
      "禁止执行或建议自己执行任意系统命令、任意文件读写、复制、移动、删除或访问工具能力之外的路径。",
      "如果用户要求的部分能力没有对应工具，必须明确说明该部分不受支持；可以继续执行其余受支持部分，但要准确说明实际结果。",
      "不得虚构工具、不得自行扩大权限，也不要声称执行了未调用或执行失败的操作。",
      "queryProduct 的 query 和 status 都是可选参数；用户未提供关键词时使用空参数查询全部商品，可按全部、已上架或已下架筛选。",
      "写操作可能要求用户确认；收到未确认结果时必须停止该写操作并准确说明。",
      "同一工具和参数连续失败时不要反复调用，应根据错误信息向用户说明。",
      "对话中会提供最近几轮上下文。可以根据上下文理解“它”“刚才那个商品”等指代，但信息不足或有歧义时必须先询问，不得猜测。",
      "只有当用户明确表达结束整个对话的意图，例如“结束”“再见”“先这样”时，才调用 endConversation。普通任务完成不等于结束对话。",
      hasConversation
        ? "需要用户确认写操作时，禁止自行用普通文本提问，必须调用 requestWriteConfirmation 保存准确工具名和参数。用户下一轮确认后，应直接调用完全匹配的写工具，不要再次询问。"
        : "当前是单轮命令模式，不要调用 requestWriteConfirmation；需要写操作时直接调用对应写工具，由执行层完成一次终端确认。",
    ].join("\n"),
  };
}

function validateConfirmationRequest(args, conversation) {
  const { name, arguments: writeArguments, message } = args;
  const validShape = Object.keys(args).every((key) => ["name", "arguments", "message"].includes(key))
    && writeTools.has(name)
    && writeArguments && typeof writeArguments === "object" && !Array.isArray(writeArguments)
    && typeof message === "string" && message.trim();
  if (!validShape || !conversation) {
    throw new RpaError("INVALID_CONFIRMATION_REQUEST", conversation
      ? "待确认写操作的名称、参数或提示语无效"
      : "单轮模式不能保存跨轮确认，请直接调用写工具");
  }
  validateToolArguments(name, writeArguments);
  const containsInternalName = [...writeTools].some((toolName) => message.includes(toolName));
  return {
    name,
    writeArguments,
    message: containsInternalName ? `确认${describeWriteOperation(name, writeArguments)}吗？` : message.trim(),
  };
}

export async function runAgent(prompt, {
  verbose = false,
  confirmWrite,
  assumeYes = false,
  conversation,
  keepBrowser = false,
  executeToolCall = runAgentToolCall,
} = {}) {
  if (!prompt?.trim()) throw new Error("请输入要交给 AI 的任务");
  if (conversation !== undefined && !(conversation instanceof AgentConversation)) {
    throw new Error("conversation 必须是 AgentConversation 实例");
  }
  if (typeof executeToolCall !== "function") throw new Error("executeToolCall 必须是函数");

  const confirmedWrite = conversation?.takeConfirmedWrite(prompt.trim()) || null;
  const taskId = createTaskId("ai");
  const startedAt = Date.now();
  const contextMessages = conversation?.getMessages() || [];
  const metrics = {
    taskId,
    contextTurns: conversation?.size || 0,
    contextMessages: contextMessages.length,
    aiCalls: 0,
    toolCalls: 0,
    writeOperations: 0,
    retries: 0,
    inputTokens: 0,
    outputTokens: 0,
    contextConfirmation: Boolean(confirmedWrite),
  };
  const completedWrites = new Map();
  const failureCounts = new Map();
  const messages = [
    createSystemMessage(Boolean(conversation)),
    ...contextMessages,
    { role: "user", content: prompt.trim() },
  ];
  const currentTurnStart = messages.length - 1;
  let browserStarted = false;
  let page;

  try {
    verboseLog(verbose, "加载会话上下文", {
      turns: metrics.contextTurns,
      messages: metrics.contextMessages,
      maxTurns: conversation?.maxTurns || 0,
    });
    for (let round = 0; round < config.aiMaxRounds; round += 1) {
      metrics.aiCalls += 1;
      const aiStartedAt = Date.now();
      verboseLog(verbose, `DeepSeek 请求第 ${round + 1} 轮`, { model: config.deepseekModel });
      const completion = await createChatCompletion(messages, {
        onRetry: (error, attempt) => {
          metrics.retries += 1;
          verboseLog(verbose, "DeepSeek 请求重试", { attempt, error: toRpaError(error).message });
        },
      });
      const { message, usage } = completion;
      metrics.inputTokens += usage?.prompt_tokens || 0;
      metrics.outputTokens += usage?.completion_tokens || 0;
      verboseLog(verbose, "DeepSeek 响应", {
        durationMs: Date.now() - aiStartedAt,
        toolCalls: message.tool_calls?.length || 0,
      });
      messages.push(message);
      if (!message.tool_calls?.length) {
        conversation?.addTurn(messages.slice(currentTurnStart));
        verboseLog(verbose, "任务指标", { ...metrics, durationMs: Date.now() - startedAt, success: true });
        return message.content || "任务已完成。";
      }

      for (const call of message.tool_calls) {
        let result;
        let fingerprint;
        let endingMessage;
        let confirmationMessage;
        const toolStartedAt = Date.now();
        try {
          const args = JSON.parse(call.function.arguments || "{}");
          metrics.toolCalls += 1;
          assertWithinBudget(metrics.toolCalls, config.aiMaxToolCalls, "AI 工具调用次数");
          verboseLog(verbose, `调用工具 ${call.function.name}`, { arguments: args });

          if (call.function.name === "requestWriteConfirmation") {
            const request = validateConfirmationRequest(args, conversation);
            confirmationMessage = request.message;
            conversation.requestWriteConfirmation(request.name, request.writeArguments, confirmationMessage);
            result = { success: true, awaitingConfirmation: true };
          } else if (call.function.name === "endConversation") {
            const unknownKeys = Object.keys(args).filter((key) => key !== "message");
            if (unknownKeys.length || (args.message !== undefined && (typeof args.message !== "string" || !args.message.trim()))) {
              throw new RpaError("INVALID_TOOL_ARGUMENTS", "endConversation 只接受可选的非空 message 字符串");
            }
            endingMessage = args.message?.trim() || "好，那我们先聊到这里。需要时再来找我。";
            result = { success: true, endConversation: true, message: endingMessage };
          } else {
            validateToolArguments(call.function.name, args);
            fingerprint = `${call.function.name}:${stableStringify(args)}`;
            if ((failureCounts.get(fingerprint) || 0) >= 2) {
              throw new RpaError("REPEATED_TOOL_FAILURE", `工具 ${call.function.name} 使用相同参数已连续失败 2 次，停止重复调用`);
            }
            if (writeTools.has(call.function.name) && completedWrites.has(fingerprint)) {
              result = { ...completedWrites.get(fingerprint), deduplicated: true };
            } else {
              if (writeTools.has(call.function.name)) {
                metrics.writeOperations += 1;
                assertWithinBudget(metrics.writeOperations, config.aiMaxWriteOperations, "AI 写操作次数");
                const confirmedByContext = confirmedWrite?.fingerprint === fingerprint;
                if (config.aiRequireWriteConfirmation && !assumeYes && !confirmedByContext) {
                  const approved = await confirmWrite?.({
                    name: call.function.name,
                    arguments: args,
                    description: describeWriteOperation(call.function.name, args),
                    taskId,
                  });
                  if (!approved) result = { success: false, code: "WRITE_NOT_CONFIRMED", error: "写操作未获得用户确认，因此没有执行" };
                }
              }

              if (!result) {
                const managesBrowser = executeToolCall === runAgentToolCall;
                if (managesBrowser && !browserStarted) {
                  ({ page } = await getBrowserSession());
                  browserStarted = true;
                }
                const execute = async (attempt) => {
                  if (managesBrowser && attempt > 1) ({ page } = await resetBrowserSession());
                  return executeToolCall({ name: call.function.name, arguments: args }, { page, taskId });
                };
                result = recoverableReadTools.has(call.function.name)
                  ? await withRetry(execute, {
                      attempts: config.retryAttempts,
                      delayMs: config.retryDelayMs,
                      shouldRetry: (error) => toRpaError(error).retryable,
                      onRetry: () => { metrics.retries += 1; },
                    })
                  : await execute(1);
                if (writeTools.has(call.function.name) && result?.success === true) completedWrites.set(fingerprint, result);
              }
            }
          }
        } catch (error) {
          result = serializeError(error);
        }

        if (fingerprint && result?.success === false) {
          failureCounts.set(fingerprint, (failureCounts.get(fingerprint) || 0) + 1);
        }
        verboseLog(verbose, `工具完成 ${call.function.name}`, {
          success: result?.success === true,
          durationMs: Date.now() - toolStartedAt,
          error: result?.error,
        });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });

        if (endingMessage) {
          messages.push({ role: "assistant", content: endingMessage });
          conversation?.addTurn(messages.slice(currentTurnStart));
          conversation?.end(endingMessage);
          verboseLog(verbose, "任务指标", { ...metrics, durationMs: Date.now() - startedAt, success: true, conversationEnded: true });
          return endingMessage;
        }
        if (confirmationMessage) {
          messages.push({ role: "assistant", content: confirmationMessage });
          conversation?.addTurn(messages.slice(currentTurnStart));
          verboseLog(verbose, "任务指标", { ...metrics, durationMs: Date.now() - startedAt, success: true, awaitingConfirmation: true });
          return confirmationMessage;
        }
      }
    }
    throw new RpaError("AGENT_BUDGET_EXCEEDED", `AI 工具调用轮次超过上限（${config.aiMaxRounds}）`);
  } catch (error) {
    const artifactPath = await captureFailureArtifacts({ page, error, taskId, metadata: metrics });
    verboseLog(verbose, "任务指标", { ...metrics, durationMs: Date.now() - startedAt, success: false, artifactPath });
    throw error;
  } finally {
    if (browserStarted && !keepBrowser) await closeBrowserSession();
  }
}
