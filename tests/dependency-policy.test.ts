import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guards the dependency decisions that fixed the "npm install crashed" problem, so a later edit cannot silently undo them.
 * Pure file inspection: no network, no Cloudflare account.
 */
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  overrides?: Record<string, Record<string, string>>;
};

describe("dependency policy", () => {
  it("pins react-router and @react-router/dev to the same exact version (the dev package hard-pins its react-router peer)", () => {
    const router = pkg.dependencies["react-router"];
    expect(router).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.devDependencies["@react-router/dev"]).toBe(router);
  });

  it("keeps the vitest peer override that avoids the npm 10.9 resolver crash", () => {
    expect(pkg.overrides?.["@vitejs/devtools-vitest"]?.vitest).toBe(pkg.devDependencies.vitest);
  });

  it("stays on vitest 4.x (vitest 5 is not part of the verified combination)", () => {
    expect(pkg.devDependencies.vitest).toMatch(/^\^4\./);
  });

  it("uses Tailwind versions that support Vite 8", () => {
    for (const name of ["tailwindcss", "@tailwindcss/vite"]) {
      const range = pkg.devDependencies[name] ?? "";
      expect(range, name).toMatch(/^\^4\.(2\.[2-9]|[3-9])/);
    }
  });
});
