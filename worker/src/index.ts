import { appMetadata, healthResponseSchema } from "@shaxda/shared";

type Env = Record<string, never>;

const worker = {
  fetch(request: Request): Response {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json(
        healthResponseSchema.parse({ ok: true, service: appMetadata.id }),
      );
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;

export default worker;
