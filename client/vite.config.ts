import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "node:path";
import AutoImport from "unplugin-auto-import/vite";

const LIVE_API = "https://p2p-backend-645830234926.asia-south1.run.app";

/**
 * RefexOne sometimes POSTs SAMLResponse to the HOME URL (SPA route).
 * Forward those POSTs to the real API ACS so SSO can complete.
 */
function refexOneSamlForwardPlugin(apiTarget: string): Plugin {
  return {
    name: "refexone-saml-forward",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathOnly = (req.url || "").split("?")[0];
        const isHomePost =
          req.method === "POST" &&
          (pathOnly === "/auth/refexone/launch" ||
            pathOnly === "/auth/refexone/callback" ||
            pathOnly === "/auth/refexone/saml/acs");

        if (!isHomePost) {
          next();
          return;
        }

        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        req.on("end", async () => {
          try {
            const body = Buffer.concat(chunks);
            const upstream = await fetch(`${apiTarget}/api/auth/refexone/saml/acs`, {
              method: "POST",
              headers: {
                "Content-Type":
                  req.headers["content-type"] || "application/x-www-form-urlencoded",
              },
              body,
              redirect: "manual",
            });

            const location = upstream.headers.get("location");
            if (location && upstream.status >= 300 && upstream.status < 400) {
              res.statusCode = upstream.status;
              res.setHeader("Location", location);
              res.end();
              return;
            }

            const text = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader(
              "Content-Type",
              upstream.headers.get("content-type") || "text/html; charset=utf-8"
            );
            res.end(text);
          } catch (err) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(
              `<h1>SAML forward failed</h1><p>${
                err instanceof Error ? err.message : "Unknown error"
              }</p>`
            );
          }
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = process.env.BASE_PATH || "/";
  const isPreview = process.env.IS_PREVIEW ? true : false;
  const API_TARGET = (env.VITE_API_URL || LIVE_API).replace(/\/$/, "");
  console.log(`[vite] API proxy → ${API_TARGET}`);

  return {
    define: {
      __BASE_PATH__: JSON.stringify(base),
      __IS_PREVIEW__: JSON.stringify(isPreview),
      __READDY_PROJECT_ID__: JSON.stringify(process.env.PROJECT_ID || ""),
      __READDY_VERSION_ID__: JSON.stringify(process.env.VERSION_ID || ""),
      __READDY_AI_DOMAIN__: JSON.stringify(process.env.READDY_AI_DOMAIN || ""),
    },
    plugins: [
      refexOneSamlForwardPlugin(API_TARGET),
      react(),
      AutoImport({
        imports: [
          {
            react: [
              "React",
              "useState",
              "useEffect",
              // Do NOT auto-import useContext / createContext — causes duplicate
              // context instances with HMR ("useAuth must be used within AuthProvider").
              "useReducer",
              "useCallback",
              "useMemo",
              "useRef",
              "useImperativeHandle",
              "useLayoutEffect",
              "useDebugValue",
              "useDeferredValue",
              "useId",
              "useInsertionEffect",
              "useSyncExternalStore",
              "useTransition",
              "startTransition",
              "lazy",
              "memo",
              "forwardRef",
              "createElement",
              "cloneElement",
              "isValidElement",
            ],
          },
          {
            "react-router-dom": [
              "useNavigate",
              "useLocation",
              "useParams",
              "useSearchParams",
              "Link",
              "NavLink",
              "Navigate",
              "Outlet",
            ],
          },
          // React i18n
          {
            "react-i18next": ["useTranslation", "Trans"],
          },
        ],
        dts: true,
      }),
    ],
    base,
    build: {
      sourcemap: true,
      outDir: "out",
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 3000,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: API_TARGET,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  };
});
