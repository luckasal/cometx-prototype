import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Resolve the router's transitive store from its owning package under pnpm.
// Otherwise the dev optimizer misses its CommonJS selector shim and hydration fails.
const require = createRequire(import.meta.url);
const routerRequire = createRequire(require.resolve("@tanstack/react-router"));
const reactStoreEntry = routerRequire.resolve("@tanstack/react-store").replace(/\.cjs$/, ".js");

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      // Use src/server.ts as the SSR entry point.
      server: { entry: "server" },
    }),
    // Nitro detects Vercel in deployment builds; do not emit a Cloudflare Worker
    // bundle for this repository's Vercel-hosted app.
    ...(command === "build" ? [nitro()] : []),
    react(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@tanstack/react-store": reactStoreEntry,
    },
    tsconfigPaths: true,
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-store",
    ],
    ignoreOutdatedRequests: true,
  },
}));
