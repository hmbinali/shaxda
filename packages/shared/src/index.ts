import { z } from "zod";

export * from "./fixtures";
export * from "./schemas";

export const appMetadata = {
  id: "shaxda",
  name: "Shaxda",
  description:
    "Shaxda waa ciyaar Soomaali ah oo lagu barto xeerarka, lagu ciyaaro hal qalab, laguna diyaariyay ciyaar marti ah.",
} as const;

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal(appMetadata.id),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
