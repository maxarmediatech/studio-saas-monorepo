import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/sessions", (c) => c.json({ status: "not_implemented" }, 501));
app.get("/sessions/:id", (c) => c.json({ status: "not_implemented" }, 501));
app.post("/sessions/:id/start", (c) => c.json({ status: "not_implemented" }, 501));
app.post("/sessions/:id/logout", (c) => c.json({ status: "not_implemented" }, 501));
app.post("/sessions/:id/send/text", (c) => c.json({ status: "not_implemented" }, 501));
app.post("/sessions/:id/send/media", (c) => c.json({ status: "not_implemented" }, 501));
app.post("/sessions/:id/mark-read", (c) => c.json({ status: "not_implemented" }, 501));

const port = Number(process.env.PORT ?? 4005);

serve({ fetch: app.fetch, port });

export { app };
