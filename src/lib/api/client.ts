import type { z } from "zod";

import { handleFixtureRequest, setFixtureRole } from "@/lib/api/fixtures";
import { ApiErrorBody, Me } from "@/shared/contracts";

/**
 * - "auto" (default): call the real backend; if the route does not exist
 *   yet (Next's HTML 404, not the backend's JSON NOT_FOUND), answer from
 *   fixtures. Pages move to live data as backend routes ship.
 * - "live": backend only. "fixture": fixtures only, no backend needed.
 */
export const API_MODE: "auto" | "live" | "fixture" =
	process.env.NEXT_PUBLIC_API_MODE === "live" ||
	process.env.NEXT_PUBLIC_API_MODE === "fixture"
		? process.env.NEXT_PUBLIC_API_MODE
		: "auto";

const API_BASE = "/api/v1";

export class ApiError extends Error {
	readonly status: number;
	readonly code: string;
	readonly fields: Record<string, string>;
	readonly details: Record<string, unknown>;

	constructor(
		status: number,
		body: {
			code: string;
			message: string;
			fields?: Record<string, string>;
			details?: Record<string, unknown>;
		}
	) {
		super(body.message);
		this.name = "ApiError";
		this.status = status;
		this.code = body.code;
		this.fields = body.fields ?? {};
		this.details = body.details ?? {};
	}
}

export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions = {
	method?: HTTPMethod;
	query?: Record<string, string | number | null | undefined>;

	/** A JSON-serializable value, or FormData for multipart uploads. */
	body?: unknown;

	/** Required on deal creation and deal actions; reuse it on retries. */
	idempotencyKey?: string;
};

/** One key per intentional submission (final backend spec §5). */
export function newIdempotencyKey(): string {
	return crypto.randomUUID();
}

/**
 * Calls the API and validates the `{ data }` envelope against `schema`.
 * Throws ApiError for an `{ error }` envelope, and for a response that breaks
 * the contract (code CONTRACT_MISMATCH), so drift shows up at the call site.
 *
 * Browser only: the path is relative, so call it from client components.
 */
export async function request<T extends z.ZodType>(
	schema: T,
	path: string,
	options: RequestOptions = {}
): Promise<z.output<T>> {
	const { method = "GET" } = options;
	const pathWithQuery = path + toQueryString(options.query);

	let response =
		API_MODE === "fixture"
			? await handleFixtureRequest(method, pathWithQuery, options.body)
			: await fetchLive(method, pathWithQuery, options);

	if (API_MODE === "auto" && isMissingRoute(response)) {
		response = await handleFixtureRequest(method, pathWithQuery, options.body);
	}

	const json: unknown = await response.json().catch(() => null);

	if (!response.ok) {
		const parsed = ApiErrorBody.safeParse(json);

		throw new ApiError(
			response.status,
			parsed.success
				? parsed.data.error
				: {
						code: "UNEXPECTED_RESPONSE",
						message: `${method} ${path} failed with ${response.status}`
					}
		);
	}

	const data =
		typeof json === "object" && json !== null && "data" in json
			? json.data
			: undefined;
	const parsed = schema.safeParse(data);

	if (!parsed.success) {
		throw new ApiError(response.status, {
			code: "CONTRACT_MISMATCH",
			message: `${method} ${path} broke the contract: ${parsed.error.message}`
		});
	}

	// Fixtures act as whoever is signed in live, once a live /me answers.
	if (path === "/me" && response.headers.get("x-fixture") === null) {
		const me = Me.safeParse(parsed.data);

		if (me.success) {
			setFixtureRole(me.data.role);
		}
	}

	return parsed.data;
}

function fetchLive(
	method: HTTPMethod,
	pathWithQuery: string,
	options: RequestOptions
): Promise<Response> {
	const { body, idempotencyKey } = options;
	const isMultipart = body instanceof FormData;
	const headers: Record<string, string> = { Accept: "application/json" };

	if (body !== undefined && !isMultipart) {
		headers["Content-Type"] = "application/json";
	}

	if (idempotencyKey !== undefined) {
		headers["Idempotency-Key"] = idempotencyKey;
	}

	return fetch(API_BASE + pathWithQuery, {
		method,
		credentials: "same-origin",
		cache: "no-store",
		headers,
		body: isMultipart
			? body
			: body === undefined
				? undefined
				: JSON.stringify(body)
	});
}

/** Next answers an unbuilt route with an HTML 404; the backend uses JSON. */
function isMissingRoute(response: Response): boolean {
	const contentType = response.headers.get("content-type") ?? "";

	return response.status === 404 && !contentType.includes("application/json");
}

function toQueryString(query: RequestOptions["query"]): string {
	if (query === undefined) {
		return "";
	}

	const params = new URLSearchParams();

	for (const [key, value] of Object.entries(query)) {
		if (value !== null && value !== undefined && value !== "") {
			params.set(key, String(value));
		}
	}

	const queryString = params.toString();

	return queryString === "" ? "" : `?${queryString}`;
}
