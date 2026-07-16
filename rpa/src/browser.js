import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import { config } from "./config.js";

let session;
let launchPromise;

function isSessionUsable(current) {
  if (!current || current.page.isClosed()) return false;
  try {
    current.context.pages();
    return true;
  } catch {
    return false;
  }
}

export async function getBrowserSession() {
  if (isSessionUsable(session)) return session;
  session = undefined;
  if (launchPromise) return launchPromise;
  launchPromise = launchBrowserSession();
  try {
    session = await launchPromise;
    return session;
  } finally {
    launchPromise = undefined;
  }
}

async function launchBrowserSession() {
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
  const current = { context, page };
  context.once("close", () => {
    if (session === current) session = undefined;
  });
  return current;
}

export async function closeBrowserSession() {
  if (!session) return;
  const current = session;
  session = undefined;
  await current.context.close().catch(() => {});
}

export async function resetBrowserSession() {
  await closeBrowserSession();
  return getBrowserSession();
}
