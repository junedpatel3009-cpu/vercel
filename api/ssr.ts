export default async function handler(req: any, res: any) {
  try {
    const { default: serverEntry } = await import("../dist/server/server.js");

    const url = new URL(req.url || "/", `https://${req.headers.host}`);
    
    const response = await serverEntry.fetch(
      new Request(url, {
        method: req.method,
        headers: new Headers(req.headers as Record<string, string>),
        body:
          req.method !== "GET" && req.method !== "HEAD" && req.body
            ? typeof req.body === "string"
              ? req.body
              : JSON.stringify(req.body)
            : undefined,
      }),
      {},
      {}
    );

    res.status(response.status);
    response.headers.forEach((value: string, key: string) => {
      res.setHeader(key, value);
    });

    if (response.body) {
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } else {
      res.send("");
    }
  } catch (error) {
    console.error("SSR Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
