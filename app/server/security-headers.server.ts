/**
 * Baseline security headers for every dynamic response.
 * (Static assets get the same headers from public/_headers.)
 * A strict Content-Security-Policy is planned for Milestone 8 together with map-provider choices.
 */
const HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

export function withSecurityHeaders(response: Response): Response {
  // Responses created by fetch() have immutable headers, so always copy first.
  const copy = new Response(response.body, response);
  for (const [name, value] of Object.entries(HEADERS)) copy.headers.set(name, value);
  return copy;
}
