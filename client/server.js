import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const PORT = process.env.PORT ?? 3000;
const FILE = new URL("./client-metadata.json", import.meta.url);

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    });
    return res.end();
  }

  if (req.method === "GET" && pathname === "/client-metadata.json") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    });
    return res.end(await readFile(FILE));
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
}).listen(PORT, () => {
  console.log(`CIMD served at http://localhost:${PORT}/client-metadata.json`);
});
