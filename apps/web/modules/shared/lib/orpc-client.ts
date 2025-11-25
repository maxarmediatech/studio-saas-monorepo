import { createORPCClient, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ApiRouterClient } from "@repo/api/orpc/router";
import { getBaseUrl } from "@repo/utils";

const link = new RPCLink({
	url: `${getBaseUrl()}/api/rpc`,
	headers: async () => {
		if (typeof window !== "undefined") {
			return {};
		}

		const { headers } = await import("next/headers");
		const forwardedHeaders = await headers();
		const blocked = new Set([
			// Let fetch calculate the correct body size for the new request
			"content-length",
			// Hop-by-hop headers that should not be forwarded
			"connection",
			"transfer-encoding",
			"host",
		]);

		return Object.fromEntries(
			Array.from(forwardedHeaders.entries()).filter(
				([key]) => !blocked.has(key.toLowerCase()),
			),
		);
	},
	interceptors: [
		onError((error) => {
			if (error instanceof Error && error.name === "AbortError") {
				return;
			}

			console.error(error);
		}),
	],
});

export const orpcClient: ApiRouterClient = createORPCClient(link);
