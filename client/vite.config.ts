import { defineConfig, loadEnv } from "vite";
import { resolve } from "path";

export default defineConfig(({ command, mode }) => {
  // Load env from both client/ and root directories
  const clientEnv = loadEnv(mode, ".", "VITE_");
  const rootEnv = loadEnv(mode, "..", "VITE_");
  const env = { ...rootEnv, ...clientEnv };

  const appBaseRewritePlugin = {
    name: "rewrite-app-base",
    apply: "serve",
    configureServer(server: any) {
      server.middlewares.use((req: any, _res: any, next: any) => {
        if (!req.url) return next();

        // Allow /app/* paths in dev to mirror production routing.
        if (req.url === "/app" || req.url.startsWith("/app/") || req.url.startsWith("/app?")) {
          const parsed = new URL(req.url, "http://localhost");
          if (parsed.pathname === "/app") {
            parsed.pathname = "/";
          } else if (parsed.pathname.startsWith("/app/")) {
            parsed.pathname = parsed.pathname.replace(/^\/app/, "");
          }
          req.url = parsed.pathname + parsed.search;
        }

        next();
      });
    },
  };

  return {
    base: command === "build" ? "/app/" : "/",
    plugins: [appBaseRewritePlugin],
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
