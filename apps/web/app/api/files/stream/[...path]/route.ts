import { auth } from "@repo/auth";
import { attachments, db, eq, submissionFiles } from "@repo/database";
import { getUploadsBucketName, hasStorageEnv } from "@repo/env";
import { getObject } from "@repo/storage";
import {
	createEnvConfigResponse,
	createEnvErrorResponse,
} from "@shared/lib/env-error-response";

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

		const organizationId = session.session.activeOrganizationId;
		if (!organizationId) {
			return new Response("Organization required", { status: 403 });
		}

		const { path } = await params;
		const fileId = path[0];

		if (!fileId) {
			return new Response("File ID required", { status: 400 });
		}

		let fileUrl: string | null = null;
		let fileName: string | null = null;
		let mimeType: string | null = null;

		const attachment = await db.query.attachments.findFirst({
			where: eq(attachments.id, fileId),
		});

		if (attachment) {
			if (attachment.organizationId !== organizationId) {
				return new Response("Forbidden", { status: 403 });
			}
			fileUrl = attachment.fileUrl;
			fileName = attachment.fileName;
			mimeType = attachment.mimeType;
		} else {
			const submissionFile = await db.query.submissionFiles.findFirst({
				where: eq(submissionFiles.id, fileId),
				with: {
					submission: {
						columns: {
							organizationId: true,
						},
					},
				},
			});

			if (submissionFile) {
				if (
					submissionFile.submission?.organizationId !== organizationId
				) {
					return new Response("Forbidden", { status: 403 });
				}
				fileUrl = submissionFile.fileUrl;
				fileName = submissionFile.fileName;
				mimeType = submissionFile.mimeType;
			}
		}

		if (!fileUrl || !fileName) {
			return new Response("Not found", { status: 404 });
		}

		const result = await getObject(fileUrl, {
			bucket: getUploadsBucketName(),
		});

		if (!result) {
			return new Response("File not found in storage", { status: 404 });
		}

		const contentType =
			mimeType ?? result.contentType ?? "application/octet-stream";
		const safeFileName = fileName.replace(/[^\w\s.-]/g, "_");

		return new Response(result.body, {
			headers: {
				"Content-Type": contentType,
				"Content-Disposition": `attachment; filename="${safeFileName}"`,
				"Cache-Control": "private, no-store",
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

		console.error("Error streaming file:", error);
		return new Response("Internal Server Error", { status: 500 });
	}
};
