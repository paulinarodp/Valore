import { mkdir, writeFile } from "node:fs/promises";

const { default: worker } = await import("../dist/server/index.js");

const response = await worker.fetch(
  new Request("https://valore-theta.vercel.app/", {
    headers: { accept: "text/html" },
  }),
  {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  },
  {
    waitUntil() {},
    passThroughOnException() {},
  },
);

if (!response.ok) {
  throw new Error(`Unable to prerender Valore: HTTP ${response.status}`);
}

const html = await response.text();
await mkdir(new URL("../dist/client/", import.meta.url), { recursive: true });
await writeFile(new URL("../dist/client/index.html", import.meta.url), html);
