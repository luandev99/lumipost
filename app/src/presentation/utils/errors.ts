// Redux Toolkit's `unwrap()` rejects with a plain SerializedError object, not an
// Error instance, so `instanceof Error` silently discards the real message.
export const errorMessage = (caught: unknown, fallback: string): string => {
  if (caught instanceof Error) return caught.message || fallback;
  if (typeof caught === "string") return caught || fallback;
  if (caught && typeof caught === "object" && "message" in caught) {
    const message = (caught as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
};
