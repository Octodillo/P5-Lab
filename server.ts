import { serveDir, serveFile } from "https://deno.land/std@0.208.0/http/file_server.ts";
import { transpile } from "jsr:@deno/emit@0.46.0";

const PORT = 8000;

const shrug = new Response("Not found", { status: 404 });
const squint = new Response("Access denied", { status: 403 });
const slapAria = new Response("Transpilation failed", { status: 500 });

const wsClients = new Set<WebSocket>();
const watcher = Deno.watchFs(["./src", "./static"]);
(async () => {
  for await (const event of watcher) {
    if (event.kind === "modify" || event.kind === "create") {
      console.log(`📝 ${event.paths.join(", ")}`);
      for (const client of wsClients) {
        try {
          client.send(JSON.stringify({ type: "reload" }));
        } catch {
          wsClients.delete(client);
        }
      }
    }
  }
})();

// deno-lint-ignore ban-types
const jsonResponse = (object: {}) =>
  new Response(JSON.stringify(object), {
    headers: { "content-type": "application/json" },
  });

const src = async (path: string[]) => {
  if (path.length === 0 || !path.toReversed()[0].endsWith(".ts")) return squint;

  path.unshift(Deno.cwd(), "src");
  const fullPath = await Deno.realPath(path.join("/"));
  if (!fullPath) return shrug;
  const url = new URL(`file://${fullPath}`);

  try {
    const result = await transpile(url, {
      load: async (specifier: string) => {
        if (specifier.startsWith("file://")) {
          const content = await Deno.readTextFile(specifier.replace("file://", ""));
          return { kind: "module", specifier, content };
        }
        return { kind: "external", specifier };
      },
      importMap: {
        imports: {
          events: "https://esm.sh/jsr/@denosaurs/event",
          p5: "https://esm.sh/p5@1.7.0",
          "@types/p5": "https://esm.sh/@types/p5@1.7.3",
        },
      },
    });

    return new Response(result.get(url.href), {
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return slapAria;
  }
};

const ws = (req: Request) => {
  if (req.headers.get("upgrade") !== "websocket") return shrug;
  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => wsClients.add(socket);
  socket.onclose = () => wsClients.delete(socket);
  socket.onerror = () => wsClients.delete(socket);

  return Promise.resolve(response);
};

const staticHeaders = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "Cache-Control": "no-cache, no-store, must-revalidate",
};

const server = Deno.serve({ port: PORT, onListen: () => {} }, (req: Request) => {
  const path = new URL(req.url).pathname;
  console.log(`🍽️\t${path}`);
  const parts = path.slice(1).split("/");
  if (parts.includes("..")) return squint;

  switch (parts.shift()) {
    case "ws":
      return ws(req);
    case "src":
      return src(parts);
    case "":
      return serveFile(req, "./static/index.html");
    default:
      return serveDir(req, {
        fsRoot: "static",
        urlRoot: "",
        headers: ["Cache-Control: no-cache, no-store, must-revalidate"],
      });
  }
});

console.log(`🎨 Server at ${server.addr.hostname}:${server.addr.port}`);
console.log(`📁 / → ./static/index.html`);
console.log(`📁 /... → ./static/...`);
console.log(`📁 /src/... → ./src/sketches/...`);
console.log(`📁 /ws → Live reload`);
console.log("🏳️‍⚧️ Transpiling TypeScript on-the-fly");
