import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { db } from "./db";
import { lenses } from "./db/schema";
import { eq } from "drizzle-orm";

const lensSchema = t.Object({
  id: t.String({ format: "uuid" }),
  modelName: t.String(),
  manufacturerName: t.String(),
  minFocalLength: t.Number(),
  maxFocalLength: t.Number(),
  maxAperture: t.String(),
  mountType: t.String(),
  dayPrice: t.String(),
  weekendPrice: t.String(),
  description: t.Nullable(t.String()),
});

const errorSchema = t.Object({
  error: t.String(),
});

const healthSchema = t.Object({
  status: t.String(),
  service: t.String(),
});

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "Suilens Catalog Service API",
          version: "1.0.0",
          description: "OpenAPI documentation for the catalog-service.",
        },
        tags: [{ name: "Catalog", description: "Lens catalog endpoints" }],
      },
    }),
  )
  .get("/api/lenses", async () => db.select().from(lenses), {
    detail: {
      summary: "Get all lenses",
      tags: ["Catalog"],
    },
    response: t.Array(lensSchema),
  })
  .get(
    "/api/lenses/:id",
    async ({ params }) => {
      const results = await db
        .select()
        .from(lenses)
        .where(eq(lenses.id, params.id));

      if (!results[0]) {
        return new Response(JSON.stringify({ error: "Lens not found" }), {
          status: 404,
        });
      }

      return results[0];
    },
    {
      detail: {
        summary: "Get lens by id",
        tags: ["Catalog"],
      },
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      response: {
        200: lensSchema,
        404: errorSchema,
      },
    },
  )
  .get("/health", () => ({ status: "ok", service: "catalog-service" }), {
    detail: {
      summary: "Health check",
      tags: ["Catalog"],
    },
    response: healthSchema,
  })
  .listen(3001);

console.log(`Catalog Service running on port ${app.server?.port}`);