import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  // Resource routes (no UI).
  route("api/auth/*", "routes/api/auth.ts"),
  route("api/health", "routes/api/health.ts"),
  route("api/areas", "routes/api/areas.ts"),
  route("logout", "routes/logout.ts"),
  route("robots.txt", "routes/seo/robots.ts"),
  route("sitemap.xml", "routes/seo/sitemap.ts"),

  // Everything with the shared THAKBO shell (header, footer, mobile tab bar).
  layout("routes/layouts/public.tsx", [
    index("routes/home.tsx"),
    route("search", "routes/search.tsx"),
    route("listing/:slug", "routes/listing.tsx"),
    route("city/:city", "routes/city.tsx"),
    route("area/:city/:area", "routes/area.tsx"),
    route("about", "routes/about.tsx"),
    route("how-it-works", "routes/how-it-works.tsx"),
    route("contact", "routes/contact.tsx"),
    route("privacy", "routes/privacy.tsx"),
    route("terms", "routes/terms.tsx"),

    route("login", "routes/login.tsx"),
    route("register", "routes/register.tsx"),
    route("forgot-password", "routes/forgot-password.tsx"),
    route("reset-password", "routes/reset-password.tsx"),

    route("403", "routes/errors/forbidden.tsx"),
    route("404", "routes/errors/not-found.tsx"),
    route("500", "routes/errors/server-error.tsx"),

    // Signed-in area. The layout middleware redirects visitors to /login.
    layout("routes/layouts/dashboard.tsx", [
      route("dashboard", "routes/dashboard/index.tsx"),
      route("dashboard/profile", "routes/dashboard/profile.tsx"),
      route("dashboard/favorites", "routes/dashboard/favorites.tsx"),
      route("dashboard/listings", "routes/dashboard/listings.tsx"),
      route("dashboard/listings/new", "routes/dashboard/listing-new.tsx"),
      route("dashboard/listings/:id/edit", "routes/dashboard/listing-edit.tsx"),
    ]),

    // Admin area. The layout middleware checks the admin_users table on the server.
    layout("routes/layouts/admin.tsx", [
      route("admin", "routes/admin/index.tsx"),
      route("admin/users", "routes/admin/users.tsx"),
      route("admin/listings", "routes/admin/listings.tsx"),
      route("admin/reports", "routes/admin/reports.tsx"),
      route("admin/locations", "routes/admin/locations.tsx"),
      route("admin/facilities", "routes/admin/facilities.tsx"),
      route("admin/settings", "routes/admin/settings.tsx"),
    ]),

    route("*", "routes/not-found-splat.tsx"),
  ]),
] satisfies RouteConfig;
