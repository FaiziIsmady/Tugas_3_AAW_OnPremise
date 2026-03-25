import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { db } from "./db";
import { orders } from "./db/schema";
import { eq } from "drizzle-orm";
import { publishEvent } from "./events";

const CATALOG_SERVICE_URL =
  process.env.CATALOG_SERVICE_URL || "http://localhost:3001";

interface CatalogLens {
  id: string;
  modelName: string;
  manufacturerName: string;
  dayPrice: string;
}

const createOrderBody = t.Object({
  customerName: t.String(),
  customerEmail: t.String({ format: "email" }),
  lensId: t.String({ format: "uuid" }),
  startDate: t.String({ format: "date" }),
  endDate: t.String({ format: "date" }),
});

const lensSnapshotSchema = t.Object({
  modelName: t.String(),
  manufacturerName: t.String(),
  dayPrice: t.String(),
});

const orderSchema = t.Object({
  id: t.String({ format: "uuid" }),
  customerName: t.String(),
  customerEmail: t.String({ format: "email" }),
  lensId: t.String({ format: "uuid" }),
  lensSnapshot: lensSnapshotSchema,
  startDate: t.String({ format: "date-time" }),
  endDate: t.String({ format: "date-time" }),
  totalPrice: t.String(),
  status: t.String(),
  createdAt: t.String({ format: "date-time" }),
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
          title: "Suilens Order Service API",
          version: "1.0.0",
          description: "OpenAPI documentation for the order-service.",
        },
        tags: [{ name: "Orders", description: "Order management endpoints" }],
      },
    }),
  )
  .post(
    "/api/orders",
    async ({ body }) => {
      const lensResponse = await fetch(
        `${CATALOG_SERVICE_URL}/api/lenses/${body.lensId}`,
      );

      if (!lensResponse.ok) {
        return new Response(JSON.stringify({ error: "Lens not found" }), {
          status: 404,
        });
      }

      const lens = (await lensResponse.json()) as CatalogLens;

      const start = new Date(body.startDate);
      const end = new Date(body.endDate);
      const days = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (days <= 0) {
        return new Response(
          JSON.stringify({ error: "End date must be after start date" }),
          { status: 400 },
        );
      }

      const totalPrice = (days * parseFloat(lens.dayPrice)).toFixed(2);

      const [order] = await db
        .insert(orders)
        .values({
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          lensId: body.lensId,
          lensSnapshot: {
            modelName: lens.modelName,
            manufacturerName: lens.manufacturerName,
            dayPrice: lens.dayPrice,
          },
          startDate: start,
          endDate: end,
          totalPrice,
        })
        .returning();

      if (!order) {
        return new Response(
          JSON.stringify({ error: "Failed to create order" }),
          { status: 500 },
        );
      }

      await publishEvent("order.placed", {
        orderId: order.id,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        lensName: lens.modelName,
      });

      return new Response(JSON.stringify(order), { status: 201 });
    },
    {
      detail: {
        summary: "Create a new order",
        tags: ["Orders"],
      },
      body: createOrderBody,
      response: {
        201: orderSchema,
        400: errorSchema,
        404: errorSchema,
        500: errorSchema,
      },
    },
  )
  .get("/api/orders", async () => db.select().from(orders), {
    detail: {
      summary: "Get all orders",
      tags: ["Orders"],
    },
    response: t.Array(orderSchema),
  })
  .get(
    "/api/orders/:id",
    async ({ params }) => {
      const results = await db
        .select()
        .from(orders)
        .where(eq(orders.id, params.id));

      if (!results[0]) {
        return new Response(JSON.stringify({ error: "Order not found" }), {
          status: 404,
        });
      }

      return results[0];
    },
    {
      detail: {
        summary: "Get order by id",
        tags: ["Orders"],
      },
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      response: {
        200: orderSchema,
        404: errorSchema,
      },
    },
  )
  .get("/health", () => ({ status: "ok", service: "order-service" }), {
    detail: {
      summary: "Health check",
      tags: ["Orders"],
    },
    response: healthSchema,
  })
  .listen(3002);

console.log(`Order Service running on port ${app.server?.port}`);