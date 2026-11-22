import { z } from "zod";
import { Id } from "./common";
import { Role } from "./enums";

/** GET /api/v1/me, POST /api/v1/demo/session response. */
export const Me = z.object({
  id: Id,
  role: Role,
  displayName: z.string(),
  /** Creator: profile is LISTED at least once. Brand/admin: always true. */
  profileReady: z.boolean(),
});
export type Me = z.infer<typeof Me>;

/** GET /api/v1/demo/accounts item. */
export const DemoAccount = z.object({ id: Id, role: Role, displayName: z.string() });
export type DemoAccount = z.infer<typeof DemoAccount>;

/** POST /api/v1/demo/session body. */
export const DemoSessionInput = z.object({ accountId: Id });
export type DemoSessionInput = z.infer<typeof DemoSessionInput>;
