export const REVIEW_CLAIM_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function reviewClaimStaleAt(reviewClaimedAt: Date | null): Date | null {
	return reviewClaimedAt
		? new Date(reviewClaimedAt.getTime() + REVIEW_CLAIM_STALE_AFTER_MS)
		: null;
}
