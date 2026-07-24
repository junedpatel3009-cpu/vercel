export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json({ data }, { status, headers });
}

export function errorResponse(error: unknown, requestId: string) {
  const status = error instanceof ApiError ? error.status : 500;
  const message = error instanceof ApiError ? error.message : "Internal server error.";
  if (status >= 500)
    console.error(
      JSON.stringify({
        level: "error",
        requestId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );
  return Response.json(
    {
      error: { message, details: error instanceof ApiError ? error.details : undefined, requestId },
    },
    { status },
  );
}

export async function body(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
}
