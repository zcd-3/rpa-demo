import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { closeBrowserSession } from "../browser.js";
import { RpaError, serializeError } from "../errors.js";
import { AgentConversation } from "./conversation.js";
import { runAgent } from "./agentRuntime.js";

export { AgentConversation, isAffirmativeConfirmation } from "./conversation.js";
export { describeWriteOperation } from "./presentation.js";
export { runAgent, runAgentToolCall } from "./agentRuntime.js";

function createConfirmationPrompt(readline) {
  return async ({ description }) => {
    const answer = await readline.question(`${description}。确认执行吗？输入 yes 继续：`);
    return answer.trim().toLowerCase() === "yes";
  };
}

async function runSinglePrompt(prompt, { verbose, assumeYes }) {
  const confirmWrite = async ({ description }) => {
    if (!process.stdin.isTTY) return false;
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return await createConfirmationPrompt(readline)({ description });
    } finally {
      readline.close();
    }
  };
  try {
    const answer = await runAgent(prompt, { verbose, assumeYes, confirmWrite });
    console.log(answer);
  } catch (error) {
    console.error(JSON.stringify(serializeError(error), null, 2));
    process.exitCode = 1;
  }
}

function printHistory(conversation) {
  const history = conversation.getHistory();
  if (!history.length) console.log("\n当前还没有已保存的对话上下文。\n");
  for (const item of history) {
    console.log(`\n第 ${item.turn} 轮`);
    console.log(`提问：${item.user}`);
    console.log(`回答：${item.assistant || "（该轮没有最终文本回答）"}`);
  }
}

async function runInteractive({ verbose, assumeYes }) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const conversation = new AgentConversation();
  const confirmWrite = createConfirmationPrompt(readline);
  console.log(`多轮会话已开始。我会记住最近 ${conversation.maxTurns} 轮上下文。`);
  console.log("随时输入 /history、/clear 或 /exit。");

  try {
    while (true) {
      const input = (await readline.question("\n› ")).trim();
      if (!input) continue;
      if (["/exit", "exit", "quit"].includes(input.toLowerCase())) break;
      if (input === "/clear") {
        conversation.clear();
        console.log("\n上下文已清空，我们可以换个话题。\n");
        continue;
      }
      if (input === "/history") {
        printHistory(conversation);
        continue;
      }
      try {
        const answer = await runAgent(input, {
          verbose,
          assumeYes,
          confirmWrite,
          conversation,
          keepBrowser: true,
        });
        console.log(`\n${answer}\n`);
        if (conversation.closed) break;
      } catch (error) {
        console.error(JSON.stringify(serializeError(error), null, 2));
      }
    }
  } finally {
    readline.close();
    await closeBrowserSession();
  }
}

async function main() {
  const cliArguments = process.argv.slice(2);
  const verbose = cliArguments.includes("--verbose") || cliArguments.includes("-v");
  const assumeYes = cliArguments.includes("--yes") || cliArguments.includes("-y");
  const prompt = cliArguments.filter((value) => !["--verbose", "-v", "--yes", "-y"].includes(value)).join(" ").trim();
  if (prompt) {
    await runSinglePrompt(prompt, { verbose, assumeYes });
    return;
  }
  if (!process.stdin.isTTY) {
    console.error(JSON.stringify(serializeError(new RpaError("PROMPT_REQUIRED", "非交互环境必须在命令后提供任务")), null, 2));
    process.exitCode = 1;
    return;
  }
  await runInteractive({ verbose, assumeYes });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
