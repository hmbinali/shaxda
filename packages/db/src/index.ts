export const databasePackage = {
  name: "@shaxda/db",
  runtime: "cloudflare-d1",
} as const;

export * from "./schema";
export * from "./queries";
