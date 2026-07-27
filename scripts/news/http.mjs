/**
 * Shared fetch — works on Node < 18 via undici polyfill.
 */
import { fetch as undiciFetch, Headers, Request, Response } from "undici";

if (typeof globalThis.fetch !== "function") {
  globalThis.fetch = undiciFetch;
  globalThis.Headers = Headers;
  globalThis.Request = Request;
  globalThis.Response = Response;
}

export const fetch = globalThis.fetch.bind(globalThis);

export function assertNodeVersion(minMajor = 18) {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < minMajor) {
    throw new Error(
      `Need Node.js ${minMajor}+ (current: ${process.versions.node}). Run: nvm use 20`,
    );
  }
}
