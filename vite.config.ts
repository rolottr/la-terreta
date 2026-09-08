import { defineConfig } from "vite";
import { compressedPublicAssets } from "./scripts/compression/vite-plugin.mjs";
export default defineConfig({
  plugins: [compressedPublicAssets()],
  build: {
    copyPublicDir: false,
    minify: "terser",
    terserOptions: { compress: { passes: 3 } },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) return "three";
        },
      },
    },
    chunkSizeWarningLimit: 650,
  },
});
