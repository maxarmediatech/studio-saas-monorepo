import { auth } from "@repo/auth";
import { and, db, eq, waMedia } from "@repo/database";
import { getUploadsBucketName, hasStorageEnv } from "@repo/env";
import { getObject } from "@repo/storage";
import {
	createEnvConfigResponse,
	createEnvErrorResponse,
} from "@shared/lib/env-error-response";

export const GET = async (
	request: Request,
	{ params }: { params: Promise<{ mediaId: string }> },
) => {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return new Response("Unauthorized", { status: 401 });
		}

		const organizationId = session.session.activeOrganizationId;
		if (!organizationId) {
			return new Response("Organization required", { status: 403 });
		}

		const { mediaId } = await params;
		if (!mediaId) {
			return new Response("Media ID required", { status: 400 });
		}

		const media = await db.query.waMedia.findFirst({
			where: and(
				eq(waMedia.id, mediaId),
				eq(waMedia.organizationId, organizationId),
			),
		});

		if (!media) {
			return new Response("Not found", { status: 404 });
		}

		if (!media.storageUrl) {
			return new Response("Media file unavailable", { status: 404 });
		}

		if (
			media.ingestStatus !== "ready" ||
			media.storageType === "provider"
		) {
			return new Response("Media not available for direct fetch", {
				status: 409,
			});
		}

		if (!hasStorageEnv()) {
			return createEnvConfigResponse("ENV_STORAGE_MISSING");
		}

		const result = await getObject(media.storageUrl, {
			bucket: getUploadsBucketName(),
		});

		if (!result) {
			return new Response("Media not found in storage", { status: 404 });
		}

		const safeFileName = (media.fileName ?? "attachment").replace(
			/[^\w\s.-]/g,
			"_",
		);

		return new Response(result.body, {
			headers: {
				"Cache-Control": "private, no-store",
				"Content-Disposition": `inline; filename="${safeFileName}"`,
				"Content-Type":
					media.mimeType ||
					result.contentType ||
					"application/octet-stream",
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

		console.error("Error serving WhatsApp media:", error);
		return new Response("Internal Server Error", { status: 500 });
	}
};
