import { auth } from "@repo/auth";
import { attachments, db, eq, submissionFiles } from "@repo/database";
import { getUploadsBucketName, hasStorageEnv } from "@repo/env";
import { getSignedUrl } from "@repo/storage";
import {
	createEnvConfigResponse,
	createEnvErrorResponse,
} from "@shared/lib/env-error-response";
import { NextResponse } from "next/server";
import { z } from "zod";

const SYSTEM_FILE_PREFIXES = ["avatars/", "org-logos/"] as const;

const MAX_PROXY_SIZE = 2 * 1024 * 1024; // 2MB - files larger than this use signed URL

const accessRequestSchema = z
	.object({
		path: z.string().optional(),
		fileId: z.string().optional(),
		intent: z.enum(["view", "download"]).default("view"),
	})
	.refine((data) => data.path || data.fileId, {
		message: "Either path or fileId is required",
	});

type DeliveryMethod = "proxy" | "stream" | "redirect";

interface AccessResponse {
	method: DeliveryMethod;
	url: string;
	filename?: string;
	expiresAt?: string;
}

function isSystemFile(path: string): boolean {
	return SYSTEM_FILE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function getDeliveryMethod(
	mimeType: string | null | undefined,
	fileSize: number | null | undefined,
	intent: "view" | "download",
): DeliveryMethod {
	const size = fileSize ?? 0;
	const mime = mimeType ?? "";

	if (size > MAX_PROXY_SIZE) {
		return "redirect";
	}

	const isImage = mime.startsWith("image/");
	if (isImage) {
		return "proxy";
	}

	const isDocument =
		mime === "application/pdf" ||
		mime.includes("document") ||
		mime.includes("word");

	if (isDocument || intent === "download") {
		return "stream";
	}

	return "proxy";
}

export async function POST(request: Request) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 },
			);
		}

		if (!hasStorageEnv()) {
			return createEnvConfigResponse("ENV_STORAGE_MISSING");
		}

		let input: z.infer<typeof accessRequestSchema>;
		try {
			input = accessRequestSchema.parse(await request.json());
		} catch (error) {
			if (error instanceof z.ZodError) {
				return NextResponse.json(
					{
						message: "Invalid input",
						errors: error.flatten().fieldErrors,
					},
					{ status: 400 },
				);
			}
			throw error;
		}

		const { path, fileId, intent } = input;
		const organizationId = session.session.activeOrganizationId;

		if (path) {
			if (path.includes("..") || path.includes("\0")) {
				return NextResponse.json(
					{ message: "Invalid path" },
					{ status: 400 },
				);
			}

			if (isSystemFile(path)) {
				const response: AccessResponse = {
					method: "proxy",
					url: `/api/files/proxy/${path}`,
				};
				return NextResponse.json(response);
			}

			if (path.startsWith("orgs/")) {
				if (!organizationId) {
					return NextResponse.json(
						{ message: "Organization required" },
						{ status: 403 },
					);
				}

				const pathOrgId = path.split("/")[1];
				if (pathOrgId !== organizationId) {
					return NextResponse.json(
						{ message: "Forbidden" },
						{ status: 403 },
					);
				}

				const signedUrl = await getSignedUrl(path, {
					bucket: getUploadsBucketName(),
					expiresIn: 60,
				});

				const response: AccessResponse = {
					method: "redirect",
					url: signedUrl,
					expiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
				};
				return NextResponse.json(response);
			}

			return NextResponse.json(
				{ message: "Invalid path" },
				{ status: 400 },
			);
		}

		if (fileId) {
			if (!organizationId) {
				return NextResponse.json(
					{ message: "Organization required" },
					{ status: 403 },
				);
			}

			const attachment = await db.query.attachments.findFirst({
				where: eq(attachments.id, fileId),
			});

			if (attachment) {
				if (attachment.organizationId !== organizationId) {
					return NextResponse.json(
						{ message: "Forbidden" },
						{ status: 403 },
					);
				}

				const method = getDeliveryMethod(
					attachment.mimeType,
					attachment.fileSize,
					intent,
				);

				if (method === "redirect") {
					const signedUrl = await getSignedUrl(attachment.fileUrl, {
						bucket: getUploadsBucketName(),
						expiresIn: 60,
					});

					const response: AccessResponse = {
						method: "redirect",
						url: signedUrl,
						filename: attachment.fileName,
						expiresAt: new Date(
							Date.now() + 60 * 1000,
						).toISOString(),
					};
					return NextResponse.json(response);
				}

				const response: AccessResponse = {
					method,
					url: `/api/files/${method}/${fileId}`,
					filename: attachment.fileName,
				};
				return NextResponse.json(response);
			}

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
					return NextResponse.json(
						{ message: "Forbidden" },
						{ status: 403 },
					);
				}

				const method = getDeliveryMethod(
					submissionFile.mimeType,
					submissionFile.fileSize,
					intent,
				);

				if (method === "redirect") {
					const signedUrl = await getSignedUrl(
						submissionFile.fileUrl,
						{
							bucket: getUploadsBucketName(),
							expiresIn: 60,
						},
					);

					const response: AccessResponse = {
						method: "redirect",
						url: signedUrl,
						filename: submissionFile.fileName,
						expiresAt: new Date(
							Date.now() + 60 * 1000,
						).toISOString(),
					};
					return NextResponse.json(response);
				}

				const response: AccessResponse = {
					method,
					url: `/api/files/${method}/${fileId}`,
					filename: submissionFile.fileName,
				};
				return NextResponse.json(response);
			}

			return NextResponse.json(
				{ message: "File not found" },
				{ status: 404 },
			);
		}

		return NextResponse.json(
			{ message: "Invalid request" },
			{ status: 400 },
		);
	} catch (error) {
		const envErrorResponse = createEnvErrorResponse(error);
		if (envErrorResponse) {
			return envErrorResponse;
		}

		console.error("Error in file access:", error);
		return NextResponse.json(
			{ message: "Internal Server Error" },
			{ status: 500 },
		);
	}
}
