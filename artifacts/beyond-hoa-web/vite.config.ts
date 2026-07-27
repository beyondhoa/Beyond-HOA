import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(async ({ mode }) => {
  const isDev = mode !== "production";
  const isReplit = process.env.REPL_ID !== undefined;

  const plugins = [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Beyond HOA",
        short_name: "BeyondHOA",
        description: "HOA community portal for residents and board members",
        theme_color: "#1e1b4b",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "./icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "./icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ];

  if (isDev && isReplit) {
    const errorModal = await import("@replit/vite-plugin-runtime-error-modal");
    const cartographer = await import("@replit/vite-plugin-cartographer");
    const devBanner = await import("@replit/vite-plugin-dev-banner");

    plugins.push(
      errorModal.default(),
      cartographer.cartographer({
        root: path.resolve(import.meta.dirname, ".."),
      }),
      devBanner.devBanner()
    );
  }

  return {
    base: "./",
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "src/assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
      cssCodeSplit: false,
      target: "es2015",
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
        },
      },
    },
    server: {
      host: true,
      port: 3000,
    },
  };
});