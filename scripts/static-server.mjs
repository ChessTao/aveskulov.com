import { createReadStream, stat } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const root = resolve(process.argv[2] || "dist/client");
const port = Number(process.argv[3]) || 5502;
const host = "127.0.0.1";
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pgn": "application/x-chess-pgn; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm"
};

function sendFile(filePath, response) {
  stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404);
      response.end("not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream"
    });
    createReadStream(filePath).pipe(response);
  });
}

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${host}`).pathname).replace(/^\/+/, "");
  let filePath = join(root, pathname);

  if (!resolve(filePath).startsWith(root)) {
    response.writeHead(403);
    response.end("forbidden");
    return;
  }

  if (!pathname || pathname.endsWith("/")) {
    filePath = join(filePath, "index.html");
  }

  sendFile(filePath, response);
}).listen(port, host, () => {
  console.log(`Preview server: http://${host}:${port}/`);
});
