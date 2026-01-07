import { auth } from "@repo/auth";
import { config } from "@repo/config";
import { deleteObject, getSignedUrl } from "@repo/storage";
import { NextResponse } from "next/server";

/**
 * DELETE /api/uploads/file
 *
 * Deletes a file from S3. Validates that the file belongs to the user's organization.
 *
 * Request body:
 * - key: S3 object key (e.g., "orgs/{orgId}/contracts/...")
 */
export async function DELETE(request: Request) {
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

		const { key }: { key: string } = await request.json();

		if (!key) {
			return NextResponse.json(
				{ message: "File key is required" },
				{ status: 400 },
			);
		}

		// Security: Verify the key belongs to the user's organization
		if (!key.startsWith(`orgs/${organizationId}/`)) {
			return NextResponse.json({ message: "Forbidden" }, { status: 403 });
		}

		await deleteObject(key, {
			bucket: config.storage.bucketNames.uploads,
		});

		return new NextResponse(null, { status: 204 });
	} catch (error) {
		console.error("Error deleting file:", error);
		return NextResponse.json(
			{ message: "Internal Server Error" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/uploads/file
 *
 * Generates a short-lived signed URL for downloading a file.
 * Validates that the file belongs to the user's organization.
 *
 * Request body:
 * - key: S3 object key (e.g., "orgs/{orgId}/contracts/...")
 *
 * Response:
 * - url: Pre-signed download URL (valid for 60 seconds)
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

		const { key }: { key: string } = await request.json();

		if (!key) {
			return NextResponse.json(
				{ message: "File key is required" },
				{ status: 400 },
			);
		}

		// Security: Verify the key belongs to the user's organization
		if (!key.startsWith(`orgs/${organizationId}/`)) {
			return NextResponse.json({ message: "Forbidden" }, { status: 403 });
		}

		// Generate a short-lived URL (60 seconds)
		const url = await getSignedUrl(key, {
			bucket: config.storage.bucketNames.uploads,
			expiresIn: 60,
		});

		return NextResponse.json({ url });
	} catch (error) {
		console.error("Error generating download URL:", error);
		return NextResponse.json(
			{ message: "Internal Server Error" },
			{ status: 500 },
		);
	}
}
