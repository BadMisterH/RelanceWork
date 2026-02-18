import { defineConfig, loadEnv } from "vite";
import { resolve } from "path";

export default defineConfig(({ command, mode }) => {
  // Load env from both client/ and root directories
  const clientEnv = loadEnv(mode, ".", "VITE_");
  const rootEnv = loadEnv(mode, "..", "VITE_");
  const env = { ...rootEnv, ...clientEnv };

  return {
    base: command === "build" ? "/app/" : "/",
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
      ),
      "import.meta.env.VITE_API_URL": JSON.stringify(
        env.VITE_API_URL || process.env.VITE_API_URL
      ),
      "import.meta.env.VITE_LANDING_URL": JSON.stringify(
        env.VITE_LANDING_URL || process.env.VITE_LANDING_URL
      ),
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
          auth: resolve(__dirname, "auth.html"),
          pricing: resolve(__dirname, "pricing.html"),
        },
      },
    },
  };
});
