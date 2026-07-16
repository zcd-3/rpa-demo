export class RpaError extends Error {
  constructor(code, message, { retryable = false, details, cause } = {}) {
    super(message, { cause });
    this.name = "RpaError";
    this.code = code;
    this.retryable = retryable;
    if (details !== undefined) this.details = details;
  }
}

export function toRpaError(error, fallbackCode = "RPA_FAILED") {
  if (error instanceof RpaError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const retryable = /timeout|timed out|target page|browser.*closed|connection|ECONNRESET|ECONNREFUSED/i.test(message);
  return new RpaError(retryable ? "TRANSIENT_BROWSER_ERROR" : fallbackCode, message, {
    retryable,
    cause: error instanceof Error ? error : undefined,
  });
}

export function serializeError(error) {
  const normalized = toRpaError(error);
  return {
    success: false,
    code: normalized.code,
    error: normalized.message,
    retryable: normalized.retryable,
    ...(normalized.details === undefined ? {} : { details: normalized.details }),
  };
}
