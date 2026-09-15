import { main } from "./pg-runner/index";

const port = Number(process.env.PORT ?? 10000);

Bun.serve({
  port,
  hostname: "0.0.0.0",
  fetch(req) {
    if (new URL(req.url).pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("rivaleye-worker running", { status: 200 });
  },
});

main().catch((err) => {
  console.error("worker main() crashed", err);
  process.exit(1);
});
