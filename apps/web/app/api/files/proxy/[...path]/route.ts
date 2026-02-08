import { auth } from "@repo/auth";
import { config } from "@repo/config";
import { hasStorageEnv } from "@repo/env";
import { getObject } from "@repo/storage";
import {
	createEnvConfigResponse,
	createEnvErrorResponse,
} from "@shared/lib/env-error-response";

const ALLOWED_PREFIXES = ["avatars/", "org-logos/"];

const MIME_TYPES: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	gif: "image/gif",
	svg: "image/svg+xml",
};

export const GET = async (
	request: Request,
	{ params }: { params: Promise<{ path: string[] }> },
) => {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return new Response("Unauthorized", { status: 401 });
		}

		if (!hasStorageEnv()) {
			return createEnvConfigResponse("ENV_STORAGE_MISSING");
		}

		const { path } = await params;
		const filePath = path.join("/");

		if (!filePath) {
			return new Response("Invalid path", { status: 400 });
		}

		if (filePath.includes("..") || filePath.includes("\0")) {
			return new Response("Invalid path", { status: 400 });
		}

		const isAllowed = ALLOWED_PREFIXES.some((prefix) =>
			filePath.startsWith(prefix),
		);

		if (!isAllowed) {
			return new Response("Forbidden", { status: 403 });
		}

		const result = await getObject(filePath, {
			bucket: config.storage.bucketNames.uploads,
		});

		if (!result) {
			return new Response("Not found", { status: 404 });
		}

		const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
		const contentType =
			result.contentType ?? MIME_TYPES[ext] ?? "application/octet-stream";

		return new Response(result.body, {
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "public, max-age=31536000, immutable",
				...(result.contentLength && {
					"Content-Length": result.contentLength.toString(),
				}),
			},
		});
	} catch (error) {
		const envErrorResponse = createEnvErrorResponse(error);
		if (envErrorResponse) {
			return envErrorResponse;
		}

		console.error("Error proxying file:", error);
		return new Response("Internal Server Error", { status: 500 });
	}
};
