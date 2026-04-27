import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      tailwindcss(),
      viteStaticCopy({
        targets: [
          {
            src: "manifest.json",
            dest: ".",
            transform: (content) => {
              return content
                .toString()
                .replace("__GOOGLE_CLIENT_ID__", env['GOOGLE_CLIENT_ID'] || "__GOOGLE_CLIENT_ID__");
            },
          },
          { src: "assets", dest: "." },
        ],
      }),
    ],
    build: {
      outDir: "dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          panel: resolve(__dirname, "src/panel/index.html"),
          "service-worker": resolve(
            __dirname,
            "src/background/service-worker.ts",
          ),
          "content/index": resolve(__dirname, "src/content/index.ts"),
        },
        output: {
          entryFileNames: (chunk) => {
            if (chunk.name === "service-worker")
              return "src/background/service-worker.js";
            if (chunk.name === "content/index") return "src/content/index.js";
            return "assets/[name]-[hash].js";
          },
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
    resolve: {
      alias: { "@": resolve(__dirname, "src") },
    },
  };
});
