import type { OperationLog, Product } from "./portalTypes";

function readArray<T>(key: string, isItem: (value: unknown) => value is T): T[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.every(isItem)) throw new Error("invalid storage data");
    return value;
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProduct(value: unknown): value is Product {
  return isRecord(value)
    && typeof value.sku === "string"
    && typeof value.asin === "string"
    && typeof value.name === "string"
    && typeof value.price === "number"
    && typeof value.stock === "number"
    && typeof value.listed === "boolean";
}

function isOperationLog(value: unknown): value is OperationLog {
  return isRecord(value)
    && typeof value.id === "number"
    && typeof value.time === "string"
    && typeof value.user === "string"
    && typeof value.action === "string"
    && typeof value.target === "string"
    && typeof value.detail === "string"
    && typeof value.result === "string";
}

export function readStoredProducts(): Product[] {
  return readArray("seller-demo-products", isProduct);
}

export function readStoredLogs(): OperationLog[] {
  return readArray("seller-demo-logs", isOperationLog);
}
