export type CreateBucketHandler = (
	name: string,
	options?: {
		public?: boolean;
	},
) => Promise<void>;

export type GetSignedUploadUrlHandler = (
	path: string,
	options: {
		bucket: string;
		contentType?: string;
		expiresIn?: number;
	},
) => Promise<string>;

export type GetSignedUrlHander = (
	path: string,
	options: {
		bucket: string;
		expiresIn?: number;
	},
) => Promise<string>;

export type PutObjectHandler = (
	path: string,
	options: {
		bucket: string;
		body: Uint8Array | Buffer | string;
		contentType?: string;
		contentLength?: number;
	},
) => Promise<void>;

export type DeleteObjectHandler = (
	path: string,
	options: {
		bucket: string;
	},
) => Promise<void>;

export type GetObjectResult = {
	body: ReadableStream<Uint8Array>;
	contentType: string | undefined;
	contentLength: number | undefined;
};

export type GetObjectHandler = (
	path: string,
	options: {
		bucket: string;
	},
) => Promise<GetObjectResult | null>;
