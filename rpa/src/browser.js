import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import { config } from "./config.js";

let session;

export async function getBrowserSession() {
  if (session) return session;
  await Promise.all([
    fs.mkdir(config.userDataDir, { recursive: true }),
    fs.mkdir(config.downloadsDir, { recursive: true }),
  ]);

  const launchOptions = {
    headless: config.headless,
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
    locale: "zh-CN",
  };
  if (config.browserChannel) launchOptions.channel = config.browserChannel;
  const context = await chromium.launchPersistentContext(config.userDataDir, launchOptions);
  context.setDefaultTimeout(config.timeout);
  const page = context.pages()[0] ?? await context.newPage();
  session = { context, page };
  return session;
}

export async function closeBrowserSession() {
  if (!session) return;
  await session.context.close();
  session = undefined;
}
