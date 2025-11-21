import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite configuration
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist", // Output directory for production build
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name].[hash][extname]",
        chunkFileNames: "assets/[name].[hash].js",
        entryFileNames: "assets/[name].[hash].js",
      },
    },
  },
  server: {
    port: 5173, // Port for Vite development server
    open: false,  // Do not open the browser automatically
  },
  base: "./", // This ensures the paths are relative
});
