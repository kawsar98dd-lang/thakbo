import type { Config } from "@react-router/dev/config";

export default {
  // SSR is required: public listing/city/area pages must be indexable.
  ssr: true,
} satisfies Config;
