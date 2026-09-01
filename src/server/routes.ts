/**
 * HTTP route handlers. Register new API routes here so `src/index.ts`
 * stays a thin entry point.
 */

import { polish } from "@/server/polish";
import type { HelloResponse } from "@/types";

export const apiRoutes = {
  /** Copy-edits the story. The only route that talks to the outside world. */
  "/api/polish": { POST: polish },

  "/api/hello": {
    async GET(): Promise<Response> {
      return Response.json({ message: "Hello, world!", method: "GET" } satisfies HelloResponse);
    },
    async PUT(): Promise<Response> {
      return Response.json({ message: "Hello, world!", method: "PUT" } satisfies HelloResponse);
    },
  },

  "/api/hello/:name": async (req: Bun.BunRequest<"/api/hello/:name">): Promise<Response> => {
    return Response.json({ message: `Hello, ${req.params.name}!` } satisfies HelloResponse);
  },
};
