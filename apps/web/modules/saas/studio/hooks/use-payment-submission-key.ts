"use client";

import { createPaymentSubmissionKeyStore } from "@saas/studio/lib/payment-submission-key-store";
import { useMemo } from "react";

/** Keeps one key for the same submitted business payload, including retries. */
export function usePaymentSubmissionKey(namespace: string) {
	return useMemo(
		() => createPaymentSubmissionKeyStore({ namespace }),
		[namespace],
	);
}
