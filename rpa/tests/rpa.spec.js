// @ts-check
import fs from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { activateProduct } from "../src/tasks/activateProduct.js";
import { downloadReport } from "../src/tasks/downloadReport.js";
import { openRefundOrders } from "../src/tasks/openRefundOrders.js";
import { queryProduct } from "../src/tasks/queryProduct.js";
import { updateProductPrice } from "../src/tasks/updateProductPrice.js";
import { updateProductStock } from "../src/tasks/updateProductStock.js";

test.describe.configure({ mode: "serial" });

test("查询商品并返回结构化字段", async ({ page }) => {
  const result = await queryProduct({ page, query: "USB" });

  expect(result.success).toBe(true);
  expect(result.count).toBe(1);
  expect(result.products[0]).toMatchObject({
    sku: "HUB-7IN1-GRY",
    asin: "B0F1S8J4W6",
  });
  expect(result.products[0].price).toEqual(expect.any(Number));
  expect(result.products[0].stock).toEqual(expect.any(Number));
});

test("价格相同时不会点击禁用的保存按钮", async ({ page }) => {
  const before = await queryProduct({ page, query: "WBH-2026-BLK" });
  const currentPrice = before.products[0].price;
  const result = await updateProductPrice({ page, sku: "WBH-2026-BLK", price: currentPrice });

  expect(result.success).toBe(true);
  expect(result.products[0].price).toBe(currentPrice);
});

test("库存相同时不会点击禁用的保存按钮", async ({ page }) => {
  const before = await queryProduct({ page, query: "WBH-2026-BLK" });
  const currentStock = before.products[0].stock;
  const result = await updateProductStock({ page, sku: "WBH-2026-BLK", stock: currentStock });

  expect(result.success).toBe(true);
  expect(result.products[0].stock).toBe(currentStock);
});

test("重复设置当前上下架状态不会反向切换", async ({ page }) => {
  const before = await queryProduct({ page, query: "HUB-7IN1-GRY" });
  const currentStatus = before.products[0].status;
  const result = await activateProduct({
    page,
    sku: "HUB-7IN1-GRY",
    active: currentStatus === "已上架",
  });

  expect(result.success).toBe(true);
  expect(result.products[0].status).toBe(currentStatus);
});

test("退款订单返回结构化数据而不是截图", async ({ page }) => {
  const result = await openRefundOrders({ page });

  expect(result.success).toBe(true);
  expect(result.count).toBeGreaterThan(0);
  expect(result.refunds[0]).toEqual(expect.objectContaining({
    id: expect.any(String),
    order: expect.any(String),
    product: expect.any(String),
    amount: expect.any(String),
    status: expect.any(String),
  }));
  expect(result).not.toHaveProperty("screenshotPath");
});

test("退货报表会映射为退款报表", async ({ page }) => {
  const result = await downloadReport({ page, type: "退货报表", range: "本月" });
  try {
    expect(result.success).toBe(true);
    expect(result.type).toBe("退款报表");
    expect(result.range).toBe("本月");
    const file = await fs.stat(result.filePath);
    expect(file.isFile()).toBe(true);
  } finally {
    await fs.rm(result.filePath, { force: true });
  }
});

test("非法报表类型会立即列出可选值", async ({ page }) => {
  await expect(downloadReport({ page, type: "库存报表", range: "本月" }))
    .rejects.toThrow("可选值：销售报表、商品报表、退款报表");
});
