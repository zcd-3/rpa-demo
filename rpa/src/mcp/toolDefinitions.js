import { z } from "zod";

const productStatus = z.enum(["全部", "已上架", "已下架"]);
const reportType = z.enum(["销售报表", "商品报表", "退款报表", "退货报表"]);
const reportRange = z.enum(["今天", "过去 7 天", "本月", "上月"]);

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const writeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const mcpToolDefinitions = [
  {
    name: "login",
    title: "登录卖家平台",
    description: "登录本地卖家平台。省略账号和密码时使用 RPA 配置中的默认凭据。",
    inputSchema: {
      email: z.string().optional().describe("可选的登录邮箱"),
      password: z.string().optional().describe("可选的登录密码"),
    },
    annotations: readOnlyAnnotations,
  },
  {
    name: "openRefundOrders",
    title: "查询退款订单",
    description: "查询退款订单并返回结构化订单信息。",
    inputSchema: {
      query: z.string().optional().describe("可选的订单号或关键词"),
    },
    annotations: readOnlyAnnotations,
  },
  {
    name: "queryProduct",
    title: "查询商品",
    description: "按商品名称、SKU 或 ASIN 查询价格、库存和上下架状态；省略参数时返回全部商品。",
    inputSchema: {
      query: z.string().optional().describe("可选的商品名称、SKU 或 ASIN 关键词"),
      status: productStatus.optional().describe("可选的上下架状态筛选"),
    },
    annotations: readOnlyAnnotations,
  },
  {
    name: "updateProductPrice",
    title: "修改商品价格",
    description: "修改指定 SKU 的商品价格并保存。调用前应向用户确认目标 SKU 和新价格。",
    inputSchema: {
      sku: z.string().trim().min(1).describe("商品 SKU"),
      price: z.number().finite().nonnegative().describe("非负商品价格"),
    },
    annotations: writeAnnotations,
  },
  {
    name: "updateProductStock",
    title: "修改商品库存",
    description: "修改指定 SKU 的商品库存并保存。调用前应向用户确认目标 SKU 和新库存。",
    inputSchema: {
      sku: z.string().trim().min(1).describe("商品 SKU"),
      stock: z.number().int().nonnegative().describe("非负整数库存"),
    },
    annotations: writeAnnotations,
  },
  {
    name: "activateProduct",
    title: "设置商品上下架状态",
    description: "将指定 SKU 的商品设置为上架或下架。调用前应向用户确认目标状态。",
    inputSchema: {
      sku: z.string().trim().min(1).describe("商品 SKU"),
      active: z.boolean().describe("true 表示上架，false 表示下架"),
    },
    annotations: writeAnnotations,
  },
  {
    name: "deactivateProduct",
    title: "下架商品",
    description: "下架指定 SKU 的商品。调用前应向用户确认目标 SKU。",
    inputSchema: {
      sku: z.string().trim().min(1).describe("商品 SKU"),
    },
    annotations: writeAnnotations,
  },
  {
    name: "downloadReport",
    title: "下载报表",
    description: "下载指定类型和周期的 CSV 报表；“退货报表”会兼容转换为“退款报表”。",
    inputSchema: {
      type: reportType.optional().describe("报表类型"),
      range: reportRange.optional().describe("报表周期"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
];
