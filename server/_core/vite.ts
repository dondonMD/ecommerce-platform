import express from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";

type ExpressApp = ReturnType<typeof express>;

export async function setupVite(app: ExpressApp, server: Server) {
  const [{ createServer: createViteServer }, { default: viteConfig }] =
    await Promise.all([import("vite"), import("../../vite.config")]);

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = (req as any).originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      (res as any).status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      (next as any)(e);
    }
  });
}

export function serveStatic(app: ExpressApp) {
  const distPath = path.resolve(process.cwd(), "dist", "public");
  const indexPath = path.resolve(distPath, "index.html");
  
  if (!fs.existsSync(distPath)) {
    console.warn(
      `[Static] Build directory not found at ${distPath}. If this is Vercel, check includeFiles in vercel.json.`
    );
  } else {
    console.log(`[Static] Serving from ${distPath}`);
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    if (!fs.existsSync(indexPath)) {
      (res as any).status(503).json({
        error: "Static client build is missing",
        hint: "Run the Vite build before deploying so dist/public/index.html exists.",
      });
      return;
    }

    (res as any).sendFile(indexPath);
  });
}
