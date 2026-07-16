import type { OperationLog, Product, Refund, ReportDefinition } from "./portalTypes";

export const seedProducts: Product[] = [
  { sku: "WBH-2026-BLK", asin: "B0D8K2L7P1", name: "无线蓝牙降噪耳机", price: 79.99, stock: 86, listed: true },
  { sku: "CGM-042-SLV", asin: "B0C9R5M2Q8", name: "便携式咖啡研磨机", price: 46.5, stock: 12, listed: true },
  { sku: "LST-110-GRY", asin: "B0B7N4H6T3", name: "人体工学笔记本支架", price: 38.9, stock: 4, listed: true },
  { sku: "HUB-7IN1-GRY", asin: "B0F1S8J4W6", name: "USB-C 7合1扩展坞", price: 55, stock: 0, listed: false },
];

export const refunds: Refund[] = [
  { id: "RMA-20260715-0048", order: "114-7829351-6845012", buyer: "Lin Chen", product: "无线蓝牙降噪耳机", amount: "US$ 79.99", reason: "商品与描述不符", status: "待处理", created: "2026-07-15 13:42", note: "买家反馈耳机右侧偶有杂音，申请退货退款。" },
  { id: "RMA-20260714-0039", order: "113-5912048-3287461", buyer: "Emma Wilson", product: "便携式咖啡研磨机", amount: "US$ 46.50", reason: "不再需要", status: "已批准", created: "2026-07-14 16:08", note: "商品未拆封，已提供退货标签。" },
  { id: "RMA-20260713-0027", order: "112-4083765-9982140", buyer: "Noah Smith", product: "人体工学笔记本支架", amount: "US$ 38.90", reason: "尺寸不合适", status: "退款完成", created: "2026-07-13 10:25", note: "退货商品已入库，退款原路退回。" },
];

export const reports: ReportDefinition[] = [
  { name: "销售报表", desc: "销售额、订单量、平均客单价", size: "18 KB" },
  { name: "商品报表", desc: "商品价格、库存和销售状态", size: "12 KB" },
  { name: "退款报表", desc: "退款原因、金额和处理状态", size: "9 KB" },
];

export const seededLogs: OperationLog[] = [
  { id: 1, time: "2026/7/15 14:18:32", user: "seller@example.com", action: "修改库存", target: "LST-110-GRY", detail: "库存从 3 修改为 4", result: "成功" },
  { id: 2, time: "2026/7/15 13:52:06", user: "seller@example.com", action: "下架商品", target: "HUB-7IN1-GRY", detail: "商品暂时停止销售", result: "成功" },
  { id: 3, time: "2026/7/15 11:24:48", user: "seller@example.com", action: "下载报表", target: "销售报表", detail: "统计周期：本月", result: "成功" },
];
