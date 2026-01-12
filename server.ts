import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.208.0/http/file_server.ts";
import { transpile } from "jsr:@deno/emit@0.46.0";

const PORT = 8000;

const wsClients = new Set<WebSocket>();
const watcher = Deno.watchFs(["./sketches", "./static"]);
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

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // WebSocket endpoint for live reload
  if (pathname === "/ws") {
    if (req.headers.get("upgrade") === "websocket") {
      const { socket, response } = Deno.upgradeWebSocket(req);

      socket.onopen = () => wsClients.add(socket);
      socket.onclose = () => wsClients.delete(socket);
      socket.onerror = () => wsClients.delete(socket);

      return response;
    }
  }

  // API endpoints
  if (pathname === "/api/sketches") {
    const sketches = await getSketches();
    return new Response(JSON.stringify(sketches), {
      headers: { "content-type": "application/json" },
    });
  }

  // API endpoint to transpile and serve TypeScript files from /sketches only
  if (pathname.startsWith("/api/src/")) {
    const requestedFile = pathname.slice("/api/src/".length);

    if (requestedFile.includes("..") || !requestedFile.endsWith(".ts")) {
      return new Response("Access denied", { status: 403 });
    }

    try {
      const filePath = `${Deno.cwd()}/sketches/${requestedFile}`;
      const realPath = await Deno.realPath(filePath).catch(() => null);
      const sketchesRealPath = await Deno.realPath(`${Deno.cwd()}/sketches`);

      if (!realPath || !realPath.startsWith(sketchesRealPath + "/")) {
        return new Response("Not found", { status: 404 });
      }

      const result = await transpile(new URL(`file://${realPath}`), {
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

      return new Response(result.get(new URL(`file://${realPath}`).href), {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      return new Response("Transpilation failed", { status: 500 });
    }
  }

  // Block all .ts file requests
  if (pathname.endsWith(".ts")) {
    return new Response("Access denied", { status: 403 });
  }

  // Serve the index page for root and any /sketches/ routes (SPA)
  if (pathname === "/" || pathname === "/index.html") {
    try {
      const indexContent = await Deno.readTextFile("./static/index.html");
      return new Response(indexContent, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "x-content-type-options": "nosniff",
          "x-frame-options": "SAMEORIGIN",
        },
      });
    } catch {
      return new Response("Index page not found", { status: 404 });
    }
  }

  // Serve static files
  if (pathname.startsWith("/static/")) {
    const response = await serveDir(req, {
      fsRoot: "static",
      urlRoot: "static",
    });
    // Add cache control for development
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    return response;
  }

  return new Response("Not found", { status: 404 });
}

async function getSketches(): Promise<string[]> {
  try {
    const sketches: string[] = [];
    for await (const entry of Deno.readDir("./sketches")) {
      if (entry.isDirectory) {
        // Check if there's a TypeScript file with the same name
        try {
          await Deno.stat(`./sketches/${entry.name}/mod.ts`);
          sketches.push(entry.name);
        } catch {
          // Skip directories without matching .ts files
        }
      }
    }
    return sketches.sort();
  } catch {
    return [];
  }
}

console.log(`🎨 Server at http://localhost:${PORT}`);
console.log(`📁 /api/src/ → ./sketches/ (TypeScript transpiled on-the-fly)`);
console.log(`🔄 Live reload enabled`);

serve(handler, { port: PORT });
