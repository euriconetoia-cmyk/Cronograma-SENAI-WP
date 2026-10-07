import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Versão do WordPress: um único app.js (CSS incluso), sem dependência de CDN para o código.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    outDir: "dist-wp", emptyOutDir: true, sourcemap: false, cssCodeSplit: false, chunkSizeWarningLimit: 6000,
    lib: { entry: "src/main.tsx", formats: ["iife"], name: "CronogramaEad", fileName: () => "app.js" },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
