import type { User } from "npm:@supabase/supabase-js@2";
import { createUserClient } from "./config.ts";
import { HttpError } from "./http.ts";

export const authenticate = async (request: Request) => {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer "))
    throw new HttpError(401, "UNAUTHENTICATED", "Sessão inválida ou expirada.");

  const client = createUserClient(authorization);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    throw new HttpError(401, "UNAUTHENTICATED", "Sessão inválida ou expirada.");
  return { client, user: data.user as User };
};

export const requirePost = (request: Request) => {
  if (request.method !== "POST")
    throw new HttpError(405, "METHOD_NOT_ALLOWED", "Método não permitido.");
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json"))
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Envie JSON válido.");
};
