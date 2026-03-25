import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { desc } from "drizzle-orm";
import { startConsumer } from "./consumer";
import { db } from "./db";
import { notifications } from "./db/schema";

const notificationSchema = t.Object({
  id: t.String({ format: "uuid" }),
  orderId: t.String({ format: "uuid" }),
  type: t.String(),
  recipient: t.String(),
  message: t.String(),
  sentAt: t.String({ format: "date-time" }),
});

const healthSchema = t.Object({
  status: t.String(),
  service: t.String(),
});

const clients = new Set<any>();

function broadcast(payload: unknown) {
  const message = JSON.stringify(payload);

  for (const client of clients) {
    try {
      client.send(message);
    } catch (error) {
      console.error("Failed to send websocket message:", error);
    }
  }
}

const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: "Suilens Notification Service API",
          version: "1.0.0",
          description: "OpenAPI documentation for the notification-service.",
        },
        tags: [
          { name: "Notifications", description: "Notification endpoints" },
        ],
      },
    }),
  )
  .get(
    "/api/notifications",
    async () =>
      db
        .select()
        .from(notifications)
        .orderBy(desc(notifications.sentAt))
        .limit(20),
    {
      detail: {
        summary: "Get recent notifications",
        tags: ["Notifications"],
      },
      response: t.Array(notificationSchema),
    },
  )
  .get("/health", () => ({ status: "ok", service: "notification-service" }), {
    detail: {
      summary: "Health check",
      tags: ["Notifications"],
    },
    response: healthSchema,
  })
  .ws("/ws/notifications", {
    open(ws) {
      clients.add(ws);
      console.log("WebSocket client connected");
    },
    close(ws) {
      clients.delete(ws);
      console.log("WebSocket client disconnected");
    },
  })
  .listen(3003);

startConsumer({
  onOrderPlaced: (payload) => {
    broadcast(payload);
  },
}).catch(console.error);

console.log(`Notification Service running on port ${app.server?.port}`);