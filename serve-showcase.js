import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_ASSETS } from "./site-assets.js";
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};
export function createServer(
  root = path.join(import.meta.dirname, "dist"),
  { readAsset = fs.readFile, logError = console.error } = {},
) {
  return http.createServer((request, response) => {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    let name;
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      name = pathname === "/" ? "index.html" : pathname.slice(1);
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (!PUBLIC_ASSETS.includes(name)) {
      response.writeHead(404).end();
      return;
    }
    readAsset(path.join(root, name), (error, content) => {
      if (error) {
        if (error.code === "ENOENT") {
          response
            .writeHead(404)
            .end("Build the showcase with node build-showcase.js first.");
        } else {
          logError(`Could not read showcase asset ${name}`, error);
          response
            .writeHead(500)
            .end(
              "Could not read a showcase asset. Check the preview server log.",
            );
        }
        return;
      }
      response.writeHead(200, {
        "Content-Type": contentTypes[path.extname(name)],
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      });
      response.end(request.method === "HEAD" ? undefined : content);
    });
  });
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const server = createServer();
  server.on("error", (error) => {
    console.error(`Preview failed: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(8080, "127.0.0.1", () =>
    console.log("Showcase preview: http://127.0.0.1:8080 (built assets only)"),
  );
}
