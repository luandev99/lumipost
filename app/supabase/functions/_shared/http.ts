import { allowedOrigins } from "./config.ts";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const corsHeaders = (request: Request): HeadersInit => {
  const origin = request.headers.get("origin") ?? "";
  const allowed = allowedOrigins();
  return {
    "Access-Control-Allow-Origin": allowed.has(origin) ? origin : "",
    "Access-Control-Allow-Headers":
      // supabase-js always sends X-Client-Info. Omitting it makes the browser
      // reject the POST after a successful OPTIONS preflight.
      "authorization, x-client-info, apikey, content-type, idempotency-key, x-trace-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
};

export const preflight = (request: Request): Response | undefined => {
  if (request.method !== "OPTIONS") return undefined;
  const origin = request.headers.get("origin") ?? "";
  if (!allowedOrigins().has(origin)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(request) });
};

export const json = (request: Request, body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

export const errorResponse = (
  request: Request,
  error: unknown,
  traceId: string,
): Response => {
  if (error instanceof HttpError)
    return json(
      request,
      { error: { code: error.code, message: error.message, traceId } },
      error.status,
    );
  const message = error instanceof Error ? error.message : "";
  const mapped = message.includes("INSUFFICIENT_CREDITS")
    ? new HttpError(
        409,
        "INSUFFICIENT_CREDITS",
        "Créditos insuficientes para concluir esta ação.",
      )
    : message.includes("CONTENT_NOT_FOUND")
      ? new HttpError(404, "CONTENT_NOT_FOUND", "Conteúdo não encontrado.")
      : message.includes("SCHEDULE_MUST_BE_FUTURE")
        ? new HttpError(
            422,
            "SCHEDULE_MUST_BE_FUTURE",
            "Escolha um horário futuro.",
          )
        : new HttpError(
            500,
            "INTERNAL_ERROR",
            "Não foi possível concluir a operação.",
          );
  console.error(JSON.stringify({ level: "error", traceId, code: mapped.code }));
  return json(
    request,
    { error: { code: mapped.code, message: mapped.message, traceId } },
    mapped.status,
  );
};

export const traceIdFor = (request: Request): string => {
  const supplied = request.headers.get("x-trace-id");
  return supplied && /^[A-Za-z0-9_-]{8,80}$/.test(supplied)
    ? supplied
    : crypto.randomUUID();
};
