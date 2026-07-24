import http from "node:http";
import { Readable } from "node:stream";
import app from "../dist/server/server.js";

const port = Number(process.env.PORT || 3000);

const server = http.createServer(async (incoming, outgoing) => {
  const start = Date.now();
  try {
    const origin = \`http://\${incoming.headers.host || \`localhost:\${port}\`}\`;
    const init = {
      method: incoming.method,
      headers: new Headers(
        Object.entries(incoming.headers).flatMap(([key, value]) =>
          Array.isArray(value)
            ? value.map((item) => [key, item])
            : value == null
              ? []
              : [[key, value]],
        ),
      ),
    };
    if (incoming.method !== "GET" && incoming.method !== "HEAD") {
      init.body = Readable.toWeb(incoming);
      init.duplex = "half";
    }
    const response = await app.fetch(
      new Request(new URL(incoming.url || "/", origin), init),
      {},
      {},
    );
    outgoing.statusCode = response.status;
    response.headers.forEach((value, key) => outgoing.setHeader(key, value));
    if (!response.body) return outgoing.end();
    Readable.fromWeb(response.body).pipe(outgoing);
  } catch (error) {
    console.error(error);
    if (!outgoing.headersSent) outgoing.writeHead(500, { "content-type": "application/json" });
    outgoing.end(JSON.stringify({ error: { message: "Internal server error." } }));
  } finally {
    const end = Date.now();
    console.log(\`\${incoming.method} \${incoming.url} \${outgoing.statusCode} -\${end - start}ms\`);
  }
});

server.listen(port, () => console.log(\`Servio listening on http://localhost:\${port}\`));
