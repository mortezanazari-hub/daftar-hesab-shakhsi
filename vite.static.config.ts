import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "static-site",
  base: "./",
  publicDir: "../public",
  plugins: [
    react(),
    {
      name: "static-pwa-manifest",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: ".nojekyll", source: "" });
        this.emitFile({
          type: "asset",
          fileName: "manifest.webmanifest",
          source: JSON.stringify({
            name: "دفتر حساب شخصی",
            short_name: "دفتر حساب",
            description: "مدیریت بدهی، طلب، اقساط، چک‌ها و دُنگ‌های مشترک",
            start_url: "./",
            display: "standalone",
            orientation: "portrait",
            background_color: "#f5f2ea",
            theme_color: "#315d4c",
            lang: "fa",
            dir: "rtl",
            icons: [
              { src: "./icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
              { src: "./icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
            ],
          }),
        });
      },
    },
  ],
  build: {
    outDir: "../static-dist",
    emptyOutDir: true,
  },
});
