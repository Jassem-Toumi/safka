import { checkOrigin } from "./origin";
import { toErrorResponse } from "./respond";

export type RouteContext<P extends Record<string, string> = Record<string, string>> = {
  params: Promise<P>;
};

/**
 * Wrap a Route Handler: loopback origin check + uniform error envelope.
 * Usage: export const GET = route(async (req, { params }) => json(...));
 */
export function route<P extends Record<string, string> = Record<string, string>>(
  handler: (req: Request, ctx: RouteContext<P>) => Promise<Response> | Response,
) {
  return async (req: Request, ctx: RouteContext<P>): Promise<Response> => {
    try {
      checkOrigin(req);
      return await handler(req, ctx ?? { params: Promise.resolve({} as P) });
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}
