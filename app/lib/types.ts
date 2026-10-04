/** Data the root route loader exposes to every page. Contains no secrets. */
export interface RootLoaderData {
  user: { name: string; email: string } | null;
  siteOrigin: string;
}
