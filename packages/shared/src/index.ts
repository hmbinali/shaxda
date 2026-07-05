import { z } from "zod";

export const appMetadata = {
  id: "shaxda",
  name: "Shaxda",
  description: "Free Somali shaxda board game.",
} as const;

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal(appMetadata.id),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
