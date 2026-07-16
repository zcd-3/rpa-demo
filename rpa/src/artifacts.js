import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { serializeError } from "./errors.js";

function safeSegment(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

export async function captureFailureArtifacts({ page, error, taskId, metadata = {} }) {
  const directory = path.join(config.artifactsDir, safeSegment(taskId));
  try {
    await fs.mkdir(directory, { recursive: true });
    const diagnostic = {
      taskId,
      capturedAt: new Date().toISOString(),
      url: page && !page.isClosed() ? page.url() : null,
      ...serializeError(error),
      metadata,
    };
    await fs.writeFile(path.join(directory, "result.json"), JSON.stringify(diagnostic, null, 2), "utf8");
    if (page && !page.isClosed()) {
      await Promise.allSettled([
        page.screenshot({ path: path.join(directory, "screenshot.png"), fullPage: true }),
        page.content().then((html) => fs.writeFile(path.join(directory, "page.html"), html, "utf8")),
      ]);
    }
    return directory;
  } catch {
    return null;
  }
}
