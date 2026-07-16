import { config } from "../config.js";
import { stableStringify } from "../reliability.js";

export function isAffirmativeConfirmation(value) {
  const normalized = String(value).trim().toLowerCase();
  return /^(是的|是|确认|可以|继续|执行|好的|好|yes|y)([，,。.!！\s]|$)/u.test(normalized);
}

export class AgentConversation {
  constructor({ maxTurns = config.aiMaxContextTurns, maxChars = config.aiMaxContextChars } = {}) {
    if (!Number.isInteger(maxTurns) || maxTurns <= 0) throw new Error("maxTurns 必须是正整数");
    if (!Number.isInteger(maxChars) || maxChars <= 0) throw new Error("maxChars 必须是正整数");
    this.maxTurns = maxTurns;
    this.maxChars = maxChars;
    this.turns = [];
    this.closed = false;
    this.closingMessage = "";
    this.pendingWrite = null;
  }

  addTurn(messages) {
    this.turns.push(structuredClone(messages));
    if (this.turns.length > this.maxTurns) this.turns.splice(0, this.turns.length - this.maxTurns);
  }

  getMessages() {
    const selected = this.turns.slice(-this.maxTurns);
    while (selected.length > 1 && JSON.stringify(selected.flat()).length > this.maxChars) selected.shift();
    return structuredClone(selected.flat());
  }

  getHistory() {
    return this.turns.map((turn, index) => ({
      turn: index + 1,
      user: turn.find((message) => message.role === "user")?.content || "",
      assistant: [...turn].reverse().find((message) => message.role === "assistant" && message.content)?.content || "",
    }));
  }

  clear() {
    this.turns.length = 0;
    this.closed = false;
    this.closingMessage = "";
    this.pendingWrite = null;
  }

  end(message) {
    this.closed = true;
    this.closingMessage = message;
    this.pendingWrite = null;
  }

  requestWriteConfirmation(name, args, message) {
    this.pendingWrite = {
      name,
      arguments: structuredClone(args),
      fingerprint: `${name}:${stableStringify(args)}`,
      message,
    };
  }

  takeConfirmedWrite(userInput) {
    const pending = this.pendingWrite;
    this.pendingWrite = null;
    if (!pending || !isAffirmativeConfirmation(userInput)) return null;
    return pending;
  }

  get size() {
    return this.turns.length;
  }
}
