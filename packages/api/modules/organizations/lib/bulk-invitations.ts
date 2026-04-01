import { z } from "zod";

export const BULK_INVITE_MAX_EMAILS = 10;

export const bulkInviteStatusSchema = z.enum([
	"created",
	"duplicate_in_batch",
	"already_member",
	"already_invited",
	"invalid_email",
	"forbidden",
	"limit_reached",
	"failed",
]);

export type BulkInviteStatus = z.infer<typeof bulkInviteStatusSchema>;

export const bulkInviteResultSchema = z.object({
	email: z.string(),
	status: bulkInviteStatusSchema,
	invitationId: z.string().optional(),
	code: z.string().optional(),
	message: z.string().optional(),
});

export type BulkInviteResult = z.infer<typeof bulkInviteResultSchema>;

export const bulkInviteInputSchema = z.object({
	emails: z.array(z.string()).min(1),
	role: z.array(z.string()).min(1),
	teamId: z.string().nullable().optional(),
});

export type BulkInviteInput = z.infer<typeof bulkInviteInputSchema>;

export const bulkInviteOutputSchema = z.object({
	summary: z.object({
		requested: z.number().int().nonnegative(),
		normalized: z.number().int().nonnegative(),
		created: z.number().int().nonnegative(),
		skipped: z.number().int().nonnegative(),
		failed: z.number().int().nonnegative(),
	}),
	results: z.array(bulkInviteResultSchema),
});

export type BulkInviteOutput = z.infer<typeof bulkInviteOutputSchema>;

const emailSchema = z.string().email();

const skippedStatuses = new Set<BulkInviteStatus>([
	"duplicate_in_batch",
	"already_member",
	"already_invited",
	"invalid_email",
]);

const failedStatuses = new Set<BulkInviteStatus>([
	"forbidden",
	"limit_reached",
	"failed",
]);

export type PreparedBulkInviteEntry =
	| {
			rawEmail: string;
			email: string;
			status: "ready";
	  }
	| {
			rawEmail: string;
			email: string;
			status: "duplicate_in_batch" | "invalid_email";
	  };

export interface PreparedBulkInviteBatch {
	requestedCount: number;
	normalizedCount: number;
	readyEmails: string[];
	entries: PreparedBulkInviteEntry[];
	duplicateCount: number;
	invalidCount: number;
	withinLimit: boolean;
}

export class BulkInviteLimitError extends Error {
	constructor(
		public readonly max: number,
		public readonly count: number,
	) {
		super(`You can invite up to ${max} unique emails at a time.`);
		this.name = "BulkInviteLimitError";
	}
}

export function splitBulkInviteEmails(raw: string): string[] {
	return raw
		.split(/[\n,;]+/)
		.map((value) => value.trim())
		.filter(Boolean);
}

export function normalizeBulkInviteEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function prepareBulkInviteBatch(
	emails: string[],
): PreparedBulkInviteBatch {
	const seen = new Set<string>();
	const readyEmails: string[] = [];
	const entries: PreparedBulkInviteEntry[] = [];
	let duplicateCount = 0;
	let invalidCount = 0;

	for (const rawEmail of emails) {
		const email = normalizeBulkInviteEmail(rawEmail);

		if (!email || !emailSchema.safeParse(email).success) {
			invalidCount += 1;
			entries.push({
				rawEmail,
				email,
				status: "invalid_email",
			});
			continue;
		}

		if (seen.has(email)) {
			duplicateCount += 1;
			entries.push({
				rawEmail,
				email,
				status: "duplicate_in_batch",
			});
			continue;
		}

		seen.add(email);
		readyEmails.push(email);
		entries.push({
			rawEmail,
			email,
			status: "ready",
		});
	}

	return {
		requestedCount: emails.length,
		normalizedCount: readyEmails.length,
		readyEmails,
		entries,
		duplicateCount,
		invalidCount,
		withinLimit: readyEmails.length <= BULK_INVITE_MAX_EMAILS,
	};
}

export function parseBulkInviteText(raw: string): PreparedBulkInviteBatch {
	return prepareBulkInviteBatch(splitBulkInviteEmails(raw));
}

export function classifyBulkInviteErrorMessage(
	message?: string | null,
): BulkInviteStatus {
	switch (message) {
		case "User is already a member of this organization":
			return "already_member";
		case "User is already invited to this organization":
			return "already_invited";
		case "Invalid email":
			return "invalid_email";
		case "Invitation limit reached":
		case "Team member limit reached":
			return "limit_reached";
		case "You are not allowed to invite users to this organization":
		case "You are not allowed to invite a user with this role":
			return "forbidden";
		default:
			return "failed";
	}
}

export function isBulkInviteSkippedStatus(status: BulkInviteStatus): boolean {
	return skippedStatuses.has(status);
}

export function isBulkInviteFailedStatus(status: BulkInviteStatus): boolean {
	return failedStatuses.has(status);
}

export function buildBulkInviteSummary({
	requestedCount,
	normalizedCount,
	results,
}: {
	requestedCount: number;
	normalizedCount: number;
	results: BulkInviteResult[];
}): BulkInviteOutput["summary"] {
	const created = results.filter(
		(result) => result.status === "created",
	).length;
	const skipped = results.filter((result) =>
		isBulkInviteSkippedStatus(result.status),
	).length;
	const failed = results.filter((result) =>
		isBulkInviteFailedStatus(result.status),
	).length;

	return {
		requested: requestedCount,
		normalized: normalizedCount,
		created,
		skipped,
		failed,
	};
}
