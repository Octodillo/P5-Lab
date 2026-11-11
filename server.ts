import { serveDir, serveFile } from "https://deno.land/std@0.208.0/http/file_server.ts";
import { transpile } from "jsr:@deno/emit@0.46.0";

const PORT = 8000;

/**
 * Collapse `X<sep>X` down to one `X`.
 *
 * @deno/emit reports parse failures twice in a single message, joined by
 * ": ", which reads as two unrelated errors. Only an exact repeat of the whole
 * string is touched, so anything that merely looks similar is left alone.
 */
const undouble = (text: string): string => {
  for (const sep of [": ", "\n", " "]) {
    const half = (text.length - sep.length) / 2;
    if (!Number.isInteger(half) || half <= 0) continue;
    const head = text.slice(0, half);
    if (text === head + sep + head) return head;
  }
  return text;
};

// Built per request: a Response body is a stream, and handing the same
// instance to two requests serves the second one an already-drained body.
const squint = () => new Response("Access denied", { status: 403 });

/**
 * A failed build, with the compiler's own words in the body.
 *
 * The browser only ever sees "failed to fetch dynamically imported module" for
 * a rejected import, so the front-end re-fetches the URL to find out why. This
 * is the only place the real diagnostic exists — throwing it away costs a
 * round trip to the terminal on every typo.
 */
const slapAria = (path: string, error: unknown) => {
  // The message carries the file, line, column and offending source; the stack
  // is all @deno/emit's wasm internals, which help nobody writing a sketch.
  const message = undouble(error instanceof Error ? error.message : String(error));
  console.error(`💥\t${path}\n${message}\n`);
  return new Response(message, {
    status: 500,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};

const srcRoot = await Deno.realPath(`${Deno.cwd()}/src`);
const root = {
  src: await Deno.realPath(`${Deno.cwd()}/src`),
  static: await Deno.realPath(`${Deno.cwd()}/static`),
};

const src = async (path: string[]) => {
  if (path.length === 0 || !path.toReversed()[0].endsWith(".ts")) return squint();

  const relative = path.join("/");
  path.unshift(Deno.cwd(), "src");

  // `realPath` throws rather than returning null when nothing is there, so a
  // missing sketch has to be caught to come back as a 404 the client can read.
  let fullPath: string;
  try {
    fullPath = await Deno.realPath(path.join("/"));
  } catch {
    return new Response(`No such file: src/${relative}`, {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (!fullPath.startsWith(srcRoot + "/")) return squint();

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

    const code = result.get(url.href);
    if (code === undefined) {
      return slapAria(relative, new Error(`Nothing was emitted for src/${relative}.`));
    }

    return new Response(code, {
      headers: {
        "content-type": "application/javascript; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return slapAria(relative, error);
  }
};

const server = Deno.serve({ port: PORT, onListen: () => {} }, (req: Request) => {
  const path = new URL(req.url).pathname;
  console.log(`🍽️\t${path}`);

  const parts = path.slice(1).split("/");

  if (parts.includes("..")) return squint();
  if (parts[0] === "_") return src(parts.slice(1));
  if (parts.toReversed()[0].includes(".")) return serveFile(req, `./static${path}`);
  return serveFile(req, "./static/index.html");
});

console.log(`🎨 Server at ${server.addr.hostname}:${server.addr.port}`);
console.log("🏳️‍⚧️ Transpiling TypeScript on-the-fly");
