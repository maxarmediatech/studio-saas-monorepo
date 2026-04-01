import {
	BULK_INVITE_MAX_EMAILS,
	BulkInviteLimitError,
	buildBulkInviteSummary,
	bulkInviteOutputSchema,
	classifyBulkInviteErrorMessage,
	normalizeBulkInviteEmail,
	prepareBulkInviteBatch,
	type BulkInviteInput,
	type BulkInviteOutput,
	type BulkInviteResult,
} from "./bulk-invitations";

export interface ExistingPendingInvitation {
	email: string;
	invitationId: string;
}

export interface ExecuteBulkInviteBatchDeps {
	findExistingMemberEmails: (emails: string[]) => Promise<string[]>;
	findPendingInvitations: (
		emails: string[],
	) => Promise<ExistingPendingInvitation[]>;
	createInvitation: (input: {
		email: string;
		role: string[];
		teamId?: string | null;
	}) => Promise<{ id: string }>;
}

function getErrorMessage(error: unknown): string | undefined {
	if (error instanceof Error) {
		return error.message;
	}

	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return error.message;
	}

	return undefined;
}

function getErrorCode(error: unknown): string | undefined {
	if (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		typeof error.code === "string"
	) {
		return error.code;
	}

	if (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		typeof error.status === "string"
	) {
		return error.status;
	}

	return undefined;
}

export async function executeBulkInviteBatch(
	input: BulkInviteInput,
	deps: ExecuteBulkInviteBatchDeps,
): Promise<BulkInviteOutput> {
	const prepared = prepareBulkInviteBatch(input.emails);

	if (prepared.normalizedCount > BULK_INVITE_MAX_EMAILS) {
		throw new BulkInviteLimitError(
			BULK_INVITE_MAX_EMAILS,
			prepared.normalizedCount,
		);
	}

	const readyEmails = prepared.readyEmails;
	const existingMemberEmails = new Set(
		(await deps.findExistingMemberEmails(readyEmails)).map(
			normalizeBulkInviteEmail,
		),
	);
	const pendingInvitationsByEmail = new Map(
		(await deps.findPendingInvitations(readyEmails)).map((invitation) => [
			normalizeBulkInviteEmail(invitation.email),
			invitation.invitationId,
		]),
	);

	const results: BulkInviteResult[] = [];

	for (const entry of prepared.entries) {
		if (entry.status !== "ready") {
			results.push({
				email: entry.email,
				status: entry.status,
			});
			continue;
		}

		if (existingMemberEmails.has(entry.email)) {
			results.push({
				email: entry.email,
				status: "already_member",
			});
			continue;
		}

		const pendingInvitationId = pendingInvitationsByEmail.get(entry.email);
		if (pendingInvitationId) {
			results.push({
				email: entry.email,
				status: "already_invited",
				invitationId: pendingInvitationId,
			});
			continue;
		}

		try {
			const invitation = await deps.createInvitation({
				email: entry.email,
				role: input.role,
				teamId: input.teamId ?? null,
			});

			results.push({
				email: entry.email,
				status: "created",
				invitationId: invitation.id,
			});
		} catch (error) {
			const message = getErrorMessage(error);

			results.push({
				email: entry.email,
				status: classifyBulkInviteErrorMessage(message),
				code: getErrorCode(error),
				message,
			});
		}
	}

	return bulkInviteOutputSchema.parse({
		summary: buildBulkInviteSummary({
			requestedCount: prepared.requestedCount,
			normalizedCount: prepared.normalizedCount,
			results,
		}),
		results,
	});
}
