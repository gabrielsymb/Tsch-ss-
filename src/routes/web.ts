import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";

const publicDirectory = resolve("public");
const katexDirectory = resolve("node_modules/katex/dist");
const assets = [
  { route: "/", file: "index.html", contentType: "text/html; charset=utf-8" },
  { route: "/styles.css", file: "styles.css", contentType: "text/css; charset=utf-8" },
  { route: "/app.js", file: "app.js", contentType: "text/javascript; charset=utf-8" },
  { route: "/favicon.svg", file: "favicon.svg", contentType: "image/svg+xml" },
] as const;
const katexAssets = [
  { route: "/katex/katex.min.css", file: "katex.min.css", contentType: "text/css; charset=utf-8" },
  { route: "/katex/katex.min.js", file: "katex.min.js", contentType: "text/javascript; charset=utf-8" },
] as const;

export async function registerWebRoutes(app: FastifyInstance): Promise<void> {
  for (const asset of assets) {
    const content = await readFile(resolve(publicDirectory, asset.file), "utf8");
    app.get(asset.route, async (_request, reply) => {
      return reply.type(asset.contentType).send(content);
    });
  }

  for (const asset of katexAssets) {
    const content = await readFile(resolve(katexDirectory, asset.file));
    app.get(asset.route, async (_request, reply) => {
      return reply.type(asset.contentType).send(content);
    });
  }

  const fontDirectory = resolve(katexDirectory, "fonts");
  const fontFiles = await readdir(fontDirectory);
  for (const file of fontFiles) {
    if (!/^KaTeX_[\w-]+\.(?:woff2?|ttf)$/.test(file)) continue;
    const contentType = file.endsWith(".ttf")
      ? "font/ttf"
      : file.endsWith(".woff2")
        ? "font/woff2"
        : "font/woff";
    const content = await readFile(resolve(fontDirectory, file));
    app.get(`/katex/fonts/${file}`, async (_request, reply) => {
      return reply.type(contentType).send(content);
    });
  }
}
