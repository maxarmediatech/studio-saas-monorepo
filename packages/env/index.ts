import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const optionalString = z.string().optional();

export const env = createEnv({
	server: {
		DATABASE_URL: optionalString,
		BETTER_AUTH_SECRET: optionalString,
		NEXT_PUBLIC_SITE_URL: optionalString,
		S3_ACCESS_KEY_ID: optionalString,
		S3_SECRET_ACCESS_KEY: optionalString,
		S3_ENDPOINT: optionalString,
		S3_REGION: optionalString,
		UPLOADS_BUCKET_NAME: optionalString,
		DODO_PAYMENTS_API_KEY: optionalString,
		DODO_PAYMENTS_WEBHOOK_SECRET: optionalString,
		DODO_PRODUCT_ID_STUDIO_BASICS_MONTHLY: optionalString,
		DODO_PRODUCT_ID_STUDIO_BASICS_YEARLY: optionalString,
		DODO_DISCOUNT_CODE_STUDIO_BASICS_MONTHLY_INTRO: optionalString,
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});

const coreEnvSchema = z.object({
	DATABASE_URL: z.string().min(1),
	BETTER_AUTH_SECRET: z.string().min(1),
	NEXT_PUBLIC_SITE_URL: z.string().url(),
});

const storageEnvSchema = z.object({
	S3_ACCESS_KEY_ID: z.string().min(1),
	S3_SECRET_ACCESS_KEY: z.string().min(1),
	S3_ENDPOINT: z.string().min(1),
	S3_REGION: z.string().min(1).default("auto"),
});

const paymentsEnvSchema = z.object({
	DODO_PAYMENTS_API_KEY: z.string().min(1),
	DODO_PAYMENTS_WEBHOOK_SECRET: z.string().min(1),
});

export type EnvConfigErrorCode =
	| "ENV_CORE_MISSING"
	| "ENV_STORAGE_MISSING"
	| "ENV_PAYMENTS_MISSING";

export class EnvConfigError extends Error {
	readonly code: EnvConfigErrorCode;
	readonly keys: string[];

	constructor({
		code,
		keys,
	}: {
		code: EnvConfigErrorCode;
		keys: string[];
	}) {
		const sortedKeys = [...new Set(keys)].sort();
		super(
			`${code}: ${sortedKeys.length > 0 ? sortedKeys.join(", ") : "unknown"}`,
		);
		this.name = "EnvConfigError";
		this.code = code;
		this.keys = sortedKeys;
	}
}

function getInvalidKeys(error: z.ZodError): string[] {
	return error.issues
		.map((issue) => {
			const [rootKey] = issue.path;
			return typeof rootKey === "string" ? rootKey : null;
		})
		.filter((key): key is string => key !== null);
}

function parseOrThrow<TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	input: unknown,
	code: EnvConfigErrorCode,
): z.infer<TSchema> {
	const parsed = schema.safeParse(input);

	if (!parsed.success) {
		throw new EnvConfigError({
			code,
			keys: getInvalidKeys(parsed.error),
		});
	}

	return parsed.data;
}

export function assertCoreEnv() {
	return parseOrThrow(coreEnvSchema, env, "ENV_CORE_MISSING");
}

export function assertStorageEnv() {
	return parseOrThrow(storageEnvSchema, env, "ENV_STORAGE_MISSING");
}

export function assertPaymentsEnv() {
	return parseOrThrow(paymentsEnvSchema, env, "ENV_PAYMENTS_MISSING");
}

export function hasStorageEnv() {
	return storageEnvSchema.safeParse(env).success;
}

export function hasPaymentsEnv() {
	return paymentsEnvSchema.safeParse(env).success;
}

export function getUploadsBucketName() {
	return env.UPLOADS_BUCKET_NAME ?? "uploads";
}

export function isEnvConfigError(error: unknown): error is EnvConfigError {
	return error instanceof EnvConfigError;
}
