import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_PROXY_API || "http://localhost:3000";
  const isProd = mode === "production";
  const apiBase =
    env.VITE_API_BASE_URL?.trim() ||
    (isProd ? "https://axecloud.com.br" : "");
  return {
    plugins: [react(), tailwindcss()],
    define: {
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(apiBase),
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
