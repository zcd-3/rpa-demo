import path from "node:path";
import { config } from "../config.js";
import { ensureLoggedIn, gotoWithRetry, timestamp } from "./helpers.js";

export async function downloadReport({ page, type = "销售报表", range = "本月" }) {
  await ensureLoggedIn(page);
  await gotoWithRetry(page, `${config.baseUrl}/reports`, { waitUntil: "domcontentloaded" });
  const typeAliases = { 退货报表: "退款报表" };
  const selectedType = typeAliases[type] || type;
  const typeSelect = page.getByTestId("report-type");
  const rangeSelect = page.locator(".report-config select").nth(1);
  await typeSelect.locator("option").first().waitFor({ state: "attached" });
  await rangeSelect.locator("option").first().waitFor({ state: "attached" });
  const availableTypes = (await typeSelect.locator("option").allTextContents()).map((value) => value.trim());
  const availableRanges = (await rangeSelect.locator("option").allTextContents()).map((value) => value.trim());
  if (!availableTypes.includes(selectedType)) {
    throw new Error(`不支持报表类型“${type}”。可选值：${availableTypes.join("、")}`);
  }
  if (!availableRanges.includes(range)) {
    throw new Error(`不支持统计周期“${range}”。可选值：${availableRanges.join("、")}`);
  }
  await typeSelect.selectOption({ label: selectedType });
  await rangeSelect.selectOption({ label: range });
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("download-report").click();
  const download = await downloadPromise;
  const suggested = download.suggestedFilename().replace(/[^\p{L}\p{N}._-]/gu, "_");
  const filePath = path.join(config.downloadsDir, `${timestamp()}-${suggested}`);
  await download.saveAs(filePath);
  return { success: true, type: selectedType, range, filePath };
}
