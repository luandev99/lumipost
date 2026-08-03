import { metaConfig } from "./config.ts";

export type MetaProfile = {
  user_id?: string;
  id?: string;
  username: string;
  name?: string;
  account_type?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
  biography?: string;
  website?: string;
};

const graphUrl = (path: string) => {
  const { graphVersion } = metaConfig();
  return `https://graph.instagram.com/${graphVersion}/${path.replace(/^\//, "")}`;
};

const metaRequest = async <T>(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    const errorObj =
      typeof payload.error === "object" && payload.error
        ? (payload.error as Record<string, unknown>)
        : {};
    const providerCode = String(errorObj.code ?? "UNKNOWN");
    const providerType = String(errorObj.type ?? "UNKNOWN");
    const providerMessage = String(errorObj.message ?? "").slice(0, 200);
    throw new Error(
      `META_API_ERROR:${response.status}:${providerType}:${providerCode}:${providerMessage}`,
    );
  }
  return payload as T;
};

export const getMetaProfile = (token: string) =>
  metaRequest<MetaProfile>(
    graphUrl(
      "me?fields=user_id,id,username,name,account_type,profile_picture_url,followers_count,media_count,biography,website",
    ),
    token,
  );

export type MetaMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  timestamp?: string;
  thumbnail_url?: string;
  media_url?: string;
};

export const getRecentMetaMedia = async (
  accountId: string,
  token: string,
): Promise<MetaMedia[]> => {
  const result = await metaRequest<{ data?: MetaMedia[] }>(
    graphUrl(
      `${accountId}/media?fields=id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url&limit=25`,
    ),
    token,
  );
  return result.data ?? [];
};

export const postMetaForm = <T>(
  path: string,
  token: string,
  fields: Record<string, string>,
) =>
  metaRequest<T>(graphUrl(path), token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });

export const getMetaContainerStatus = (containerId: string, token: string) =>
  metaRequest<{
    id: string;
    status_code?:
      | "EXPIRED"
      | "ERROR"
      | "FINISHED"
      | "IN_PROGRESS"
      | "PUBLISHED";
    status?: string;
  }>(graphUrl(`${containerId}?fields=id,status_code,status`), token);
