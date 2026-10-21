/**
 * Generic 500 response for Edge Functions. The real error (message + stack)
 * goes to the function log with a short reference id; the caller only sees
 * the id, never internal details (CodeQL js/stack-trace-exposure).
 */
export function internalErrorResponse(tag: string, err: unknown, headers: HeadersInit): Response {
  const ref = crypto.randomUUID().slice(0, 8);
  // eslint-disable-next-line no-console -- top-level error path
  console.error(`[${tag}] error ref=${ref}:`, err);
  return new Response(
    JSON.stringify({ error: "Something went wrong. Please try again.", ref }),
    { status: 500, headers },
  );
}
