import {
	DeleteObjectCommand,
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl as getS3SignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertStorageEnv } from "@repo/env";
import { logger } from "@repo/logs";
import type {
	DeleteObjectHandler,
	GetObjectHandler,
	GetSignedUploadUrlHandler,
	GetSignedUrlHander,
} from "../../types";

let s3Client: S3Client | null = null;

const getS3Client = () => {
	if (s3Client) {
		return s3Client;
	}

	const {
		S3_ENDPOINT: s3Endpoint,
		S3_REGION: s3Region,
		S3_ACCESS_KEY_ID: s3AccessKeyId,
		S3_SECRET_ACCESS_KEY: s3SecretAccessKey,
	} = assertStorageEnv();

	s3Client = new S3Client({
		region: s3Region,
		endpoint: s3Endpoint,
		forcePathStyle: true,
		credentials: {
			accessKeyId: s3AccessKeyId,
			secretAccessKey: s3SecretAccessKey,
		},
	});

	return s3Client;
};

export const getSignedUploadUrl: GetSignedUploadUrlHandler = async (
	path,
	{ bucket, contentType, expiresIn = 60 },
) => {
	const s3Client = getS3Client();
	try {
		return await getS3SignedUrl(
			s3Client,
			new PutObjectCommand({
				Bucket: bucket,
				Key: path,
				ContentType: contentType || "application/octet-stream",
			}),
			{
				expiresIn,
			},
		);
	} catch (e) {
		logger.error(e);

		throw new Error("Could not get signed upload url");
	}
};

export const getSignedUrl: GetSignedUrlHander = async (
	path,
	{ bucket, expiresIn },
) => {
	const s3Client = getS3Client();
	try {
		return getS3SignedUrl(
			s3Client,
			new GetObjectCommand({ Bucket: bucket, Key: path }),
			{ expiresIn },
		);
	} catch (e) {
		logger.error(e);
		throw new Error("Could not get signed url");
	}
};

export const deleteObject: DeleteObjectHandler = async (path, { bucket }) => {
	const s3Client = getS3Client();
	try {
		await s3Client.send(
			new DeleteObjectCommand({
				Bucket: bucket,
				Key: path,
			}),
		);
	} catch (e) {
		logger.error(e);
		throw new Error("Could not delete object");
	}
};

export const getObject: GetObjectHandler = async (path, { bucket }) => {
	const s3Client = getS3Client();
	try {
		const response = await s3Client.send(
			new GetObjectCommand({
				Bucket: bucket,
				Key: path,
			}),
		);

		if (!response.Body) {
			return null;
		}

		// Convert SDK stream to web ReadableStream
		const webStream = response.Body.transformToWebStream();

		return {
			body: webStream,
			contentType: response.ContentType,
			contentLength: response.ContentLength,
		};
	} catch (e) {
		// Check if it's a "not found" error
		if (
			e instanceof Error &&
			(e.name === "NoSuchKey" || e.name === "NotFound")
		) {
			return null;
		}
		logger.error(e);
		throw new Error("Could not get object");
	}
};
