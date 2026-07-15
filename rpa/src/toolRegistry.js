import { login } from "./tasks/login.js";
import { openRefundOrders } from "./tasks/openRefundOrders.js";
import { queryProduct } from "./tasks/queryProduct.js";
import { updateProductPrice } from "./tasks/updateProductPrice.js";
import { updateProductStock } from "./tasks/updateProductStock.js";
import { activateProduct, deactivateProduct } from "./tasks/activateProduct.js";
import { downloadReport } from "./tasks/downloadReport.js";

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

export async function executeTool(name, args) {
  const tool = toolRegistry.get(name);
  if (!tool) throw new Error(`未知任务：${name}。可用任务：${listTools().join(", ")}`);
  return tool(args);
}
