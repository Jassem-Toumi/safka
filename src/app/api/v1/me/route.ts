import { meFor, requireUser } from "@/server/http/auth";
import { json } from "@/server/http/respond";
import { route } from "@/server/http/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/me */
export const GET = route((req) => json(meFor(requireUser(req))));
