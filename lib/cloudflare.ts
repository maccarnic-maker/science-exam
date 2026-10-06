// lib/cloudflare.ts – Safe Cloudflare bindings getter
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest } from "next/server";

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1Result>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
}

export interface AppEnv {
  DB?: D1Database;
  R2?: R2Bucket;
  [key: string]: unknown;
}

export function getAppEnv(req?: NextRequest): AppEnv {
  try {
    const ctx = getCloudflareContext();
    if (ctx?.env) {
      return ctx.env as AppEnv;
    }
  } catch {
    // Test requests can supply bindings without the Workers runtime.
  }

  if (req && (req as unknown as { env?: AppEnv }).env) {
    return (req as unknown as { env?: AppEnv }).env!;
  }

  const g = globalThis as unknown as AppEnv;
  return g;
}

export function getDB(req?: NextRequest): D1Database | undefined {
  const env = getAppEnv(req);
  return env.DB;
}

export function getR2(req?: NextRequest): R2Bucket | undefined {
  const env = getAppEnv(req);
  return env.R2;
}
