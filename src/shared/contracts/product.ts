import { z } from "zod";
import { Id, IsoDateTime } from "./common";

export const ProductInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  /** Optional HTTPS URL. Empty string is treated as null. */
  landingUrl: z
    .string()
    .trim()
    .max(2048)
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https:\/\//i.test(v), { message: "Must be an https:// URL" }),
});
export type ProductInput = z.input<typeof ProductInput>;

export const ProductPatch = ProductInput.partial();
export type ProductPatch = z.input<typeof ProductPatch>;

export const Product = z.object({
  id: Id,
  name: z.string(),
  description: z.string(),
  landingUrl: z.string().nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Product = z.infer<typeof Product>;
