import {
	and,
	db,
	desc,
	eq,
	gt,
	isNotNull,
	isNull,
	lte,
	or,
	sql,
} from "@repo/database";
import { waAccounts, waMedia, waMessages } from "@repo/whatsapp-db";
import { decryptWhatsAppStoredSecret } from "@repo/whatsapp-outbox";
import { ingestCloudApiMediaAsset } from "./cloud-api-media";

const DEFAULT_API_VERSION = "v22.0";
const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

export type InboundMediaItem = {
	account: typeof waAccounts.$inferSelect;
	media: typeof waMedia.$inferSelect;
	message: typeof waMessages.$inferSelect;
};

type IngestMedia = typeof ingestCloudApiMediaAsset;

const computeNextAttemptAt = (attempts: number) => {
	const delaySeconds = Math.min(30 * attempts, 15 * 60);
	return new Date(Date.now() + delaySeconds * 1000);
};

export const recoverExpiredWhatsAppMediaLeases = async (now = new Date()) => {
	const rows = await db
		.update(waMedia)
		.set({
			ingestStatus: "pending",
			ingestLockedBy: null,
			ingestLeaseExpiresAt: null,
			nextIngestAttemptAt: now,
			ingestErrorMessage: "Recovered expired media processing lease",
		})
		.where(
			and(
				eq(waMedia.ingestStatus, "processing"),
				lte(waMedia.ingestLeaseExpiresAt, now),
			),
		)
		.returning({ id: waMedia.id });

	return rows.length;
};

export const fetchDueInboundMedia = async ({
	limit,
	now = new Date(),
}: {
	limit: number;
	now?: Date;
}) => {
	await recoverExpiredWhatsAppMediaLeases(now);
	return db
		.select({ account: waAccounts, media: waMedia, message: waMessages })
		.from(waMedia)
		.innerJoin(waMessages, eq(waMessages.mediaId, waMedia.id))
		.innerJoin(waAccounts, eq(waMessages.accountId, waAccounts.id))
		.where(
			and(
				eq(waMessages.direction, "inbound"),
				eq(waAccounts.provider, "cloud_api"),
				isNotNull(waMedia.providerMediaId),
				eq(waMedia.ingestStatus, "pending"),
				or(
					isNull(waMedia.nextIngestAttemptAt),
					lte(waMedia.nextIngestAttemptAt, now),
				),
				sql`${waMedia.ingestAttempts} < ${DEFAULT_MAX_ATTEMPTS}`,
			),
		)
		.orderBy(desc(waMessages.createdAt))
		.limit(limit);
};

const claimInboundMedia = async (params: {
	mediaId: string;
	workerId: string;
	leaseMs: number;
	now: Date;
}) => {
	const [claimed] = await db
		.update(waMedia)
		.set({
			ingestStatus: "processing",
			ingestAttempts: sql`${waMedia.ingestAttempts} + 1`,
			lastIngestAttemptAt: params.now,
			nextIngestAttemptAt: null,
			ingestLockedBy: params.workerId,
			ingestLeaseExpiresAt: new Date(
				params.now.getTime() + params.leaseMs,
			),
			ingestErrorMessage: null,
		})
		.where(
			and(
				eq(waMedia.id, params.mediaId),
				eq(waMedia.ingestStatus, "pending"),
				or(
					isNull(waMedia.nextIngestAttemptAt),
					lte(waMedia.nextIngestAttemptAt, params.now),
				),
				sql`${waMedia.ingestAttempts} < ${DEFAULT_MAX_ATTEMPTS}`,
			),
		)
		.returning({ attempts: waMedia.ingestAttempts });

	return claimed ?? null;
};

const markReady = async (params: {
	mediaId: string;
	workerId: string;
	fileName: string;
	fileSize: number | null;
	mimeType: string;
	storageUrl: string;
}) => {
	const [updated] = await db
		.update(waMedia)
		.set({
			fileName: params.fileName,
			fileSize: params.fileSize,
			mimeType: params.mimeType,
			storageType: "s3",
			storageUrl: params.storageUrl,
			ingestStatus: "ready",
			ingestLockedBy: null,
			ingestLeaseExpiresAt: null,
			ingestErrorMessage: null,
			nextIngestAttemptAt: null,
		})
		.where(
			and(
				eq(waMedia.id, params.mediaId),
				eq(waMedia.ingestStatus, "processing"),
				eq(waMedia.ingestLockedBy, params.workerId),
				gt(waMedia.ingestLeaseExpiresAt, new Date()),
			),
		)
		.returning({ id: waMedia.id });

	if (!updated) {
		throw new Error("WhatsApp media lease lost before completion");
	}
};

const markFailure = (params: {
	mediaId: string;
	workerId: string;
	attempts: number;
	errorMessage: string;
}) =>
	db
		.update(waMedia)
		.set({
			ingestStatus:
				params.attempts >= DEFAULT_MAX_ATTEMPTS ? "failed" : "pending",
			ingestLockedBy: null,
			ingestLeaseExpiresAt: null,
			ingestErrorMessage: params.errorMessage,
			nextIngestAttemptAt:
				params.attempts >= DEFAULT_MAX_ATTEMPTS
					? null
					: computeNextAttemptAt(params.attempts),
			storageUrl: null,
		})
		.where(
			and(
				eq(waMedia.id, params.mediaId),
				eq(waMedia.ingestStatus, "processing"),
				eq(waMedia.ingestLockedBy, params.workerId),
			),
		);

export const processInboundMediaItem = async (
	item: InboundMediaItem,
	options: {
		workerId: string;
		leaseMs?: number;
		now?: Date;
		ingest?: IngestMedia;
	},
) => {
	if (!item.media.providerMediaId || !item.account.accessToken) {
		return { status: "invalid" as const };
	}

	const claim = await claimInboundMedia({
		mediaId: item.media.id,
		workerId: options.workerId,
		leaseMs: options.leaseMs ?? DEFAULT_LEASE_MS,
		now: options.now ?? new Date(),
	});
	if (!claim) {
		return { status: "skipped" as const };
	}

	try {
		const asset = await (options.ingest ?? ingestCloudApiMediaAsset)({
			accessToken: decryptWhatsAppStoredSecret(item.account.accessToken),
			accountId: item.account.id,
			organizationId: item.account.organizationId,
			apiVersion: DEFAULT_API_VERSION,
			fileName: item.media.fileName,
			mediaId: item.media.providerMediaId,
			messageType: item.message.type,
			mimeType: item.media.mimeType,
		});
		await markReady({
			mediaId: item.media.id,
			workerId: options.workerId,
			...asset,
		});
		return { status: "ready" as const };
	} catch (error) {
		await markFailure({
			mediaId: item.media.id,
			workerId: options.workerId,
			attempts: claim.attempts,
			errorMessage:
				error instanceof Error
					? error.message
					: "Unknown media ingest error",
		});
		return { status: "failed" as const };
	}
};
