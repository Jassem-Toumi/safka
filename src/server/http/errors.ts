import type { ErrorCode } from "@/shared/contracts/enums";
import { ERROR_STATUS } from "@/shared/contracts/common";

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly fields?: Record<string, string>,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

export const notFound = (what = "Resource") => new ApiError("NOT_FOUND", `${what} not found.`);
export const forbidden = (msg = "You can't do that with this account.") => new ApiError("FORBIDDEN", msg);
export const invalidState = (msg: string) => new ApiError("INVALID_STATE", msg);
