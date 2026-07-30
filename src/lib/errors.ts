export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status, headers: { "content-type": "application/json" } },
    );
  }

  const message = error instanceof Error ? error.message : "An unexpected error occurred.";
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message } },
    { status: 500, headers: { "content-type": "application/json" } },
  );
}
