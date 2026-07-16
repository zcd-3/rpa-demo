import { login } from "./tasks/login.js";
import { openRefundOrders } from "./tasks/openRefundOrders.js";
import { queryProduct } from "./tasks/queryProduct.js";
import { updateProductPrice } from "./tasks/updateProductPrice.js";
import { updateProductStock } from "./tasks/updateProductStock.js";
import { activateProduct, deactivateProduct } from "./tasks/activateProduct.js";
import { downloadReport } from "./tasks/downloadReport.js";
import { RpaError } from "./errors.js";

export const toolRegistry = new Map([
  ["login", login],
  ["openRefundOrders", openRefundOrders],
  ["queryProduct", queryProduct],
  ["updateProductPrice", updateProductPrice],
  ["updateProductStock", updateProductStock],
  ["activateProduct", activateProduct],
  ["deactivateProduct", deactivateProduct],
  ["downloadReport", downloadReport],
]);

export function listTools() {
  return [...toolRegistry.keys()];
}

const runtimeKeys = new Set(["page", "taskId", "operationId"]);
const schemas = {
  login: { optional: { email: "string", password: "string" } },
  openRefundOrders: { optional: { query: "string" } },
  queryProduct: { optional: { query: "string", status: ["全部", "已上架", "已下架"] } },
  updateProductPrice: { required: { sku: "nonEmptyString", price: "nonNegativeNumber" } },
  updateProductStock: { required: { sku: "nonEmptyString", stock: "nonNegativeInteger" } },
  activateProduct: { required: { sku: "nonEmptyString", active: "boolean" } },
  deactivateProduct: { required: { sku: "nonEmptyString" } },
  downloadReport: {
    optional: {
      type: ["销售报表", "商品报表", "退款报表", "退货报表"],
      range: ["今天", "过去 7 天", "本月", "上月"],
    },
  },
};

function matches(value, rule) {
  if (Array.isArray(rule)) return rule.includes(value);
  if (rule === "string") return typeof value === "string";
  if (rule === "nonEmptyString") return typeof value === "string" && value.trim().length > 0;
  if (rule === "boolean") return typeof value === "boolean";
  if (rule === "nonNegativeNumber") return typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (rule === "nonNegativeInteger") return Number.isInteger(value) && value >= 0;
  return false;
}

function describeRule(rule) {
  if (Array.isArray(rule)) return `可选值：${rule.join("、")}`;
  return ({
    string: "字符串",
    nonEmptyString: "非空字符串",
    boolean: "布尔值",
    nonNegativeNumber: "非负数字",
    nonNegativeInteger: "非负整数",
  })[rule] || String(rule);
}

export function validateToolArguments(name, args = {}) {
  const schema = schemas[name];
  if (!schema) throw new RpaError("UNKNOWN_TOOL", `未知任务：${name}。可用任务：${listTools().join(", ")}`);
  const required = schema.required || {};
  const optional = schema.optional || {};
  const allowed = new Set([...Object.keys(required), ...Object.keys(optional)]);
  for (const key of Object.keys(args)) {
    if (!runtimeKeys.has(key) && !allowed.has(key)) {
      throw new RpaError("INVALID_TOOL_ARGUMENTS", `${name} 不支持参数“${key}”`, { details: { tool: name, key } });
    }
  }
  for (const [key, rule] of Object.entries(required)) {
    if (!matches(args[key], rule)) {
      throw new RpaError("INVALID_TOOL_ARGUMENTS", `${name} 的参数 ${key} 必须是${describeRule(rule)}`, { details: { tool: name, key } });
    }
  }
  for (const [key, rule] of Object.entries(optional)) {
    if (args[key] !== undefined && !matches(args[key], rule)) {
      throw new RpaError("INVALID_TOOL_ARGUMENTS", `${name} 的参数 ${key} 必须是${describeRule(rule)}`, { details: { tool: name, key } });
    }
  }
  return args;
}

export async function executeTool(name, args) {
  const tool = toolRegistry.get(name);
  if (!tool) throw new RpaError("UNKNOWN_TOOL", `未知任务：${name}。可用任务：${listTools().join(", ")}`);
  validateToolArguments(name, args);
  return tool(args);
}
