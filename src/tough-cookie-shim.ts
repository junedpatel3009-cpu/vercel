import * as toughCookie from "../node_modules/tough-cookie/dist/index.js";

// Provide a default export wrapper for ESM interop at runtime
const _default = {
  ...toughCookie,
  Cookie: (toughCookie as any).Cookie,
  CookieJar: (toughCookie as any).CookieJar,
  MemoryCookieStore: (toughCookie as any).MemoryCookieStore,
  Store: (toughCookie as any).Store,
} as any;

export default _default;
export * from "../node_modules/tough-cookie/dist/index.js";
