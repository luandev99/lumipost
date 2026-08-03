import { required } from "./config.ts";

// Contrato confirmado na documentação oficial (docs.higgsfield.ai/docs/guides/video
// e código-fonte do SDK oficial @higgsfield/client, não em suposição): auth por
// par KEY_ID:KEY_SECRET combinado num único secret, endpoint /v1/image2video/dop,
// submit + poll assíncrono (a geração leva de ~45s a alguns minutos).
const BASE_URL = "https://platform.higgsfield.ai";

export type HiggsfieldJobStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "nsfw";

const authHeader = () => `Key ${required("HIGGSFIELD_API_KEY")}`;

export const submitVideoJob = async (input: {
  imageUrl: string;
  prompt: string;
}): Promise<{ providerRequestId: string; status: HiggsfieldJobStatus }> => {
  const response = await fetch(`${BASE_URL}/v1/image2video/dop`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      input: {
        model: "dop-turbo",
        prompt: input.prompt.slice(0, 2000),
        input_images: [{ type: "image_url", image_url: input.imageUrl }],
      },
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    request_id?: string;
    status?: HiggsfieldJobStatus;
    error?: { message?: string };
    message?: string;
  };
  if (!response.ok || !payload.request_id)
    throw new Error(
      `HIGGSFIELD_SUBMIT_FAILED:${response.status}:${(payload.error?.message ?? payload.message ?? "").slice(0, 200)}`,
    );
  return {
    providerRequestId: payload.request_id,
    status: payload.status ?? "queued",
  };
};

export const checkVideoJob = async (
  providerRequestId: string,
): Promise<{ status: HiggsfieldJobStatus; videoUrl?: string }> => {
  const response = await fetch(
    `${BASE_URL}/requests/${providerRequestId}/status`,
    { headers: { Authorization: authHeader(), Accept: "application/json" } },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    status?: HiggsfieldJobStatus;
    video?: { url?: string };
    error?: { message?: string };
    message?: string;
  };
  if (!response.ok)
    throw new Error(
      `HIGGSFIELD_STATUS_FAILED:${response.status}:${(payload.error?.message ?? payload.message ?? "").slice(0, 200)}`,
    );
  return { status: payload.status ?? "in_progress", videoUrl: payload.video?.url };
};
