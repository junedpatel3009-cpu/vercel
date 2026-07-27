import type { IncomingMessage, ServerResponse } from "node:http";
import { initializeUserDatabase } from "../src/lib/user-db.server";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    // Vercel functions receive a fresh /tmp filesystem on cold starts.  Create
    // the SQLite schema before route modules issue their first User query.
    initializeUserDatabase();

    // @ts-expect-error Generated build output
    const { default: serverEntry } = await import("../dist/server/server.js");

    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `https://${host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        value.forEach((v) => headers.append(key, v));
      } else if (value) {
        headers.set(key, value);
      }
    }

    const response = await serverEntry.fetch(
      new Request(url, {
        method: req.method,
        headers,
      }),
      {},
      {},
    );

    res.statusCode = response.status;
    response.headers.forEach((value: string, key: string) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      const buffer = await response.arrayBuffer();
      res.end(Buffer.from(buffer));
    } else {
      res.end("");
    }
  } catch (error) {
    console.error("SSR Error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
