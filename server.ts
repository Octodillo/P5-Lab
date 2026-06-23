import { serveDir, serveFile } from "https://deno.land/std@0.208.0/http/file_server.ts";
import { transpile } from "jsr:@deno/emit@0.46.0";

const PORT = 8000;

const shrug = new Response("Not found", { status: 404 });
const squint = new Response("Access denied", { status: 403 });
const slapAria = new Response("Transpilation failed", { status: 500 });

const srcRoot = await Deno.realPath(`${Deno.cwd()}/src`);
const root = {
  src: await Deno.realPath(`${Deno.cwd()}/src`),
  static: await Deno.realPath(`${Deno.cwd()}/static`),
};

const src = async (path: string[]) => {
  if (path.length === 0 || !path.toReversed()[0].endsWith(".ts")) return squint;

  path.unshift(Deno.cwd(), "src");
  const fullPath = await Deno.realPath(path.join("/"));
  if (!fullPath) return shrug;
  if (!fullPath.startsWith(srcRoot + "/")) return squint;

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

const server = Deno.serve({ port: PORT, onListen: () => {} }, (req: Request) => {
  const path = new URL(req.url).pathname;
  console.log(`🍽️\t${path}`);

  const parts = path.slice(1).split("/");

  if (parts.includes("..")) return squint;
  if (parts[0] === "_") return src(parts.slice(1));
  if (parts.toReversed()[0].includes(".")) return serveFile(req, `./static${path}`);
  return serveFile(req, "./static/index.html");
});

console.log(`🎨 Server at ${server.addr.hostname}:${server.addr.port}`);
console.log("🏳️‍⚧️ Transpiling TypeScript on-the-fly");
