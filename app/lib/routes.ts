/** Central list of URL paths so links are never typed by hand. */

export const PATHS = {
  home: "/",
  search: "/search",
  about: "/about",
  howItWorks: "/how-it-works",
  contact: "/contact",
  privacy: "/privacy",
  terms: "/terms",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  logout: "/logout",
  dashboard: "/dashboard",
  profile: "/dashboard/profile",
  favorites: "/dashboard/favorites",
  myListings: "/dashboard/listings",
  newListing: "/dashboard/listings/new",
  admin: "/admin",
  adminUsers: "/admin/users",
  adminListings: "/admin/listings",
  adminReports: "/admin/reports",
  adminLocations: "/admin/locations",
  adminFacilities: "/admin/facilities",
  adminSettings: "/admin/settings",
  forbidden: "/403",
  notFound: "/404",
  serverError: "/500",
  authApi: "/api/auth",
} as const;

export const listingPath = (slug: string) => `/listing/${encodeURIComponent(slug)}`;
export const cityPath = (city: string) => `/city/${encodeURIComponent(city)}`;
export const areaPath = (city: string, area: string) =>
  `/area/${encodeURIComponent(city)}/${encodeURIComponent(area)}`;
export const editListingPath = (id: string) => `/dashboard/listings/${encodeURIComponent(id)}/edit`;

/** Paths listed in the sitemap that do not depend on database content. */
export const STATIC_SITEMAP_PATHS = [PATHS.home, PATHS.about, PATHS.howItWorks, PATHS.contact, PATHS.privacy, PATHS.terms];

/**
 * Only same-site relative paths are accepted after login. Rejects absolute URLs,
 * protocol-relative URLs ("//evil.com") and backslash tricks (open-redirect protection).
 */
export function safeRedirectPath(input: string | null | undefined, fallback: string = PATHS.dashboard): string {
  if (!input) return fallback;
  if (!input.startsWith("/") || input.startsWith("//") || input.includes("\\")) return fallback;
  // Reject control characters (code points below 0x20), e.g. line breaks used for header injection.
  for (let i = 0; i < input.length; i += 1) {
    if (input.charCodeAt(i) < 0x20) return fallback;
  }
  return input;
}

/**
 * Returns "/path?query" for the page a request belongs to, removing React Router's internal
 * data-request details (".data" suffix, "_routes" and "index" parameters).
 */
export function pageFromRequestUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  let path = url.pathname.replace(/^\/_(?:root)?\.data$/, "/").replace(/\/_\.data$/, "/").replace(/\.data$/, "");
  if (path === "") path = "/";
  url.searchParams.delete("_routes");
  url.searchParams.delete("index");
  const query = url.searchParams.toString();
  return query ? `${path}?${query}` : path;
}
