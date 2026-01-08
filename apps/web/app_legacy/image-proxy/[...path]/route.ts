import { config } from "@repo/config";
import { getSignedUrl } from "@repo/storage";
import { NextResponse } from "next/server";

/**
 * Only these prefixes are publicly accessible via the image proxy.
 * This prevents unauthorized access to private documents stored in the uploads bucket.
 */
const ALLOWED_PUBLIC_PREFIXES = ["avatars/", "org-logos/"];

export const GET = async (
	_req: Request,
	{ params }: { params: Promise<{ path: string[] }> },
) => {
	const { path } = await params;

	// Handle nested paths: ["uploads", "avatars", "uuid.png"]
	const [bucket, ...rest] = path;
	const filePath = rest.join("/");

	if (!(bucket && filePath)) {
		return new Response("Invalid path", { status: 400 });
	}

	// Only allow uploads bucket
	if (bucket !== config.storage.bucketNames.uploads) {
		return new Response("Not found", { status: 404 });
	}

	// SECURITY: Only allow public asset prefixes
	const isAllowedPrefix = ALLOWED_PUBLIC_PREFIXES.some((prefix) =>
		filePath.startsWith(prefix),
	);

	if (!isAllowedPrefix) {
		return new Response("Not found", { status: 404 });
	}

	// Additional security: reject suspicious patterns
	if (filePath.includes("..") || filePath.includes("\0")) {
		return new Response("Invalid path", { status: 400 });
	}

	const signedUrl = await getSignedUrl(filePath, {
		bucket,
		expiresIn: 60 * 60,
	});

	return NextResponse.redirect(signedUrl, {
		headers: { "Cache-Control": "max-age=3600" },
	});
};
