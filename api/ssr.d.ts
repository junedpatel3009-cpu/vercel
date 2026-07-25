declare module "../dist/server/server.js" {
  const serverEntry: {
    fetch: (request: Request, env?: unknown, ctx?: unknown) => Promise<Response>;
  };
  export default serverEntry;
}
