import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auth } from "@repo/auth";
import { config } from "@repo/config";
import { getSignedUploadUrl } from "@repo/storage";
import { NextResponse } from "next/server";

/**
 * Valid upload contexts for organizing files in S3.
 */
const UPLOAD_CONTEXTS = {
	contracts: "contracts",
	payments: "payments",
	deliverables: "deliverables",
	shoots: "shoots",
	receipts: "receipts",
	documents: "documents",
} as const;

type UploadContext = keyof typeof UPLOAD_CONTEXTS;

/**
 * Maximum file sizes per context (in bytes)
 */
const MAX_FILE_SIZES: Record<UploadContext, number> = {
	contracts: 10 * 1024 * 1024,     // 10MB
	payments: 5 * 1024 * 1024,       // 5MB
	receipts: 5 * 1024 * 1024,       // 5MB
	documents: 25 * 1024 * 1024,     // 25MB
	deliverables: 100 * 1024 * 1024, // 100MB (TBD)
	shoots: 100 * 1024 * 1024,       // 100MB (TBD)
};

/**
 * Allowed MIME types per context
 */
const ALLOWED_MIME_TYPES: Record<UploadContext, string[]> = {
	contracts: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
	payments: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
	deliverables: ["application/pdf", "image/jpeg", "image/png", "video/mp4", "application/zip"],
	shoots: ["image/jpeg", "image/png", "image/webp", "video/mp4"],
	receipts: ["application/pdf", "image/jpeg", "image/png"],
	documents: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
};

/**
 * Input validation schema
 */
const presignedUrlInputSchema = z.object({
	fileName: z.string().min(1, "fileName is required").max(255, "fileName too long"),
	fileType: z.string().min(1, "fileType is required").max(100),
	fileSize: z.number().int().positive().max(100 * 1024 * 1024, "File too large"),
	context: z.enum(["contracts", "payments", "deliverables", "shoots", "receipts", "documents"]),
});

/**
 * Sanitizes a filename by removing special characters and spaces.
 * Preserves alphanumeric characters, dots, and hyphens.
 */
const sanitizeFilename = (filename: string): string => {
	return filename
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/[^a-zA-Z0-9-.]/g, "");
};

/**
 * POST /api/uploads/presigned-url
 *
 * Generates a pre-signed S3 URL for direct file upload from the browser.
 * The file is stored under: orgs/{orgId}/{context}/{timestamp}-{uuid}-{filename}
 *
 * Request body:
 * - fileName: Original filename (will be sanitized)
 * - fileType: MIME type (e.g., "application/pdf", "image/jpeg")
 * - context: Upload context (contracts, payments, deliverables, etc.)
 *
 * Response:
 * - url: Pre-signed S3 URL for PUT request
 * - key: S3 object key for storing in database
 */
export async function POST(request: Request) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const organizationId = session.session.activeOrganizationId;

		if (!organizationId) {
			return NextResponse.json(
				{ message: "User not associated with an organization" },
				{ status: 403 },
			);
		}

		// Parse and validate input
		let input: z.infer<typeof presignedUrlInputSchema>;
		try {
			input = presignedUrlInputSchema.parse(await request.json());
		} catch (error) {
			if (error instanceof z.ZodError) {
				return NextResponse.json(
					{ message: "Invalid input", errors: error.flatten().fieldErrors },
					{ status: 400 },
				);
			}
			throw error;
		}

		const { fileName, fileType, fileSize, context } = input;

		// Validate file size for context
		const maxSize = MAX_FILE_SIZES[context];
		if (fileSize > maxSize) {
			return NextResponse.json(
				{ message: `File too large. Maximum size for ${context}: ${Math.floor(maxSize / 1024 / 1024)}MB` },
				{ status: 400 },
			);
		}

		// Validate MIME type for context
		const allowedTypes = ALLOWED_MIME_TYPES[context];
		if (!allowedTypes.includes(fileType)) {
			return NextResponse.json(
				{ message: `File type '${fileType}' not allowed for ${context}` },
				{ status: 400 },
			);
		}

		// Security: Explicit path traversal rejection (defense in depth)
		if (
			fileName.includes("..") ||
			fileName.includes("/") ||
			fileName.includes("\\") ||
			fileName.includes("\0") // null byte injection
		) {
			return NextResponse.json(
				{ message: "Invalid filename: contains forbidden characters" },
				{ status: 400 },
			);
		}

		const folderPath = UPLOAD_CONTEXTS[context];
		const sanitizedFile = sanitizeFilename(fileName);
		const timestamp = Date.now();

		// Key format: orgs/{orgId}/{context}/{timestamp}-{uuid}-{filename}
		const key = `orgs/${organizationId}/${folderPath}/${timestamp}-${randomUUID()}-${sanitizedFile}`;

		const url = await getSignedUploadUrl(key, {
			bucket: config.storage.bucketNames.uploads,
			contentType: fileType,
			expiresIn: 300, // 5 minutes to complete upload
		});

		return NextResponse.json({ url, key });
	} catch (error) {
		console.error("Error generating presigned URL:", error);
		return NextResponse.json(
			{ message: "Internal Server Error" },
			{ status: 500 },
		);
	}
}
