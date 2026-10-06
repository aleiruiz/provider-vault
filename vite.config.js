import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

// Tiny local API that stores the *already encrypted* vault in <dataDir>/vault.json.
// It never sees plaintext. It only answers requests for localhost and refuses cross-site ones.
function vaultApi(dataDir) {
  const DATA_DIR = path.resolve(dataDir);
  const FILE = path.join(DATA_DIR, "vault.json");
  const PREV = path.join(DATA_DIR, "vault.prev.json");

  const currentRev = () => {
    try {
      return Number(JSON.parse(fs.readFileSync(FILE, "utf8")).rev) || 0;
    } catch {
      return 0;
    }
  };

  const handler = (req, res, next) => {
    if (!req.url.startsWith("/api/vault")) return next();
    const origin = req.headers.origin;
    const originHost = origin ? origin.replace(/^https?:\/\//, "") : "";
    if (!LOCAL.test(req.headers.host || "") || (origin && !LOCAL.test(originHost))) {
      res.statusCode = 403;
      return res.end("forbidden");
    }
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "GET") {
      if (!fs.existsSync(FILE)) {
        res.statusCode = 404;
        return res.end();
      }
      res.setHeader("Content-Type", "application/json");
      return res.end(fs.readFileSync(FILE));
    }

    if (req.method === "PUT") {
      if (req.headers["x-vault"] !== "1") {
        res.statusCode = 403;
        return res.end("forbidden");
      }
      const chunks = [];
      let size = 0;
      req.on("data", (c) => {
        size += c.length;
        if (size > 8 * 1024 * 1024) req.destroy();
        else chunks.push(c);
      });
      req.on("end", () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (body.v !== 1 || !body.kdf || !body.wrapPass || !body.data)
            throw new Error("bad vault");
          const cur = currentRev();
          const base = Number(req.headers["x-base-rev"] || 0);
          if (req.headers["x-force"] !== "1" && base !== cur) {
            res.statusCode = 409;
            return res.end("conflict");
          }
          body.rev = cur + 1;
          fs.mkdirSync(DATA_DIR, { recursive: true });
          if (fs.existsSync(FILE)) fs.copyFileSync(FILE, PREV);
          const tmp = FILE + ".tmp";
          fs.writeFileSync(tmp, JSON.stringify(body));
          fs.renameSync(tmp, FILE);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ rev: body.rev }));
        } catch {
          res.statusCode = 400;
          res.end("bad request");
        }
      });
      return;
    }
    res.statusCode = 405;
    res.end();
  };
  return {
    name: "vault-api",
    configureServer(s) {
      s.middlewares.use(handler);
    },
    configurePreviewServer(s) {
      s.middlewares.use(handler);
    },
  };
}

// `vite --mode demo` runs on its own port with its own vault folder, so demo data can never
// touch a real vault. VAULT_DIR overrides the folder (handy for tests).
export default defineConfig(({ mode }) => {
  const demo = mode === "demo";
  const port = demo ? 5191 : 5190;
  const dataDir = process.env.VAULT_DIR || (demo ? "data-demo" : "data");
  return {
    plugins: [react(), vaultApi(dataDir)],
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
  };
});
