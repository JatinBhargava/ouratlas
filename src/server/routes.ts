/**
 * HTTP route handlers. Register new API routes here so `src/index.ts`
 * stays a thin entry point.
 */

import type { HelloResponse } from "@/types";

export const apiRoutes = {
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
