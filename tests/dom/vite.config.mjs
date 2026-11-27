import { defineConfig } from "vite";
import { resolve } from "node:path";

/**
 * Bundles the jsdom DOM harnesses so they can import real application source
 * (TypeScript, JSX, CSS side-effect free). Each harness is a separate entry so
 * React state from one run never leaks into another.
 *
 * Usage from the repository root:
 *   npx vite build --config tests/dom/vite.config.mjs
 *   node tests/dom/dist/explore-dom.mjs
 *   node tests/dom/dist/cinematic-dom.mjs
 */
export default defineConfig({
  root: resolve(import.meta.dirname, "../.."),
  logLevel: "warn",
  define: {
    "import.meta.env.VITE_AUDIO_SOURCE": JSON.stringify("/audio/omj.m4a"),
  },
  // The public/ directory is copied by the app build; the harnesses never read
  // those assets and copying them would duplicate the 2.6 MB recording.
  publicDir: false,
  build: {
    ssr: true,
    target: "node22",
    outDir: "tests/dom/dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        "explore-dom": resolve(import.meta.dirname, "explore-dom.mjs"),
        "cinematic-dom": resolve(import.meta.dirname, "cinematic-dom.mjs"),
        "layout-dom": resolve(import.meta.dirname, "layout-dom.mjs"),
      },
      external: ["jsdom"],
      output: { entryFileNames: "[name].mjs", format: "es" },
    },
  },
});
