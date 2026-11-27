import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The sandbox preview proxies requests from a generated *.e2b.app host, so the
  // dev server must accept that host in addition to localhost. Production builds
  // are served by Vercel and are unaffected by this setting.
  server: {
    host: true,
    allowedHosts: [".e2b.app", ".e2b.dev", "localhost"],
  },
  preview: {
    host: true,
    allowedHosts: [".e2b.app", ".e2b.dev", "localhost"],
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
