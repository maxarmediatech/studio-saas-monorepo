"use client";

import type { CheckoutStatus } from "@repo/payments/lib/checkout";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { useRouter } from "@shared/hooks/router";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import {
	AlertCircleIcon,
	CheckCircle2Icon,
	Loader2Icon,
	RefreshCcwIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { clearPendingCheckoutCookie } from "../lib/pending-checkout-cookie";

const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 30_000;

export function CheckoutCompletionPageClient({
	checkoutSessionId,
	organizationId,
	expectedPriceKeys,
	initialStatus,
	redirectTo,
	fallbackHref,
}: {
	checkoutSessionId?: string;
	organizationId?: string;
	expectedPriceKeys: string[];
	initialStatus: CheckoutStatus;
	redirectTo: string;
	fallbackHref: string;
}) {
	const router = useRouter();
	const [hasTimedOut, setHasTimedOut] = useState(false);

	const statusQuery = useQuery({
		...orpc.payments.getCheckoutStatus.queryOptions({
			input: {
				checkoutSessionId,
				organizationId,
				expectedPriceKeys,
			},
		}),
		initialData: initialStatus,
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			if (
				status === "active" ||
				status === "failed" ||
				status === "cancelled" ||
				hasTimedOut
			) {
				return false;
			}

			return POLL_INTERVAL_MS;
		},
		staleTime: POLL_INTERVAL_MS,
		refetchOnWindowFocus: true,
	});

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			setHasTimedOut(true);
		}, MAX_WAIT_MS);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, []);

	useEffect(() => {
		if (statusQuery.data?.status === "active") {
			clearPendingCheckoutCookie();
			router.replace(redirectTo);
		}
	}, [redirectTo, router, statusQuery.data?.status]);

	useEffect(() => {
		if (
			statusQuery.data?.status === "failed" ||
			statusQuery.data?.status === "cancelled"
		) {
			clearPendingCheckoutCookie();
		}
	}, [statusQuery.data?.status]);

	const status = statusQuery.data?.status ?? "pending";
	const isCheckingNow =
		statusQuery.isFetching && statusQuery.fetchStatus === "fetching";

	if (statusQuery.isError) {
		return (
			<div className="space-y-4 rounded-3xl border bg-background/90 p-6">
				<div className="flex items-center gap-3">
					<AlertCircleIcon className="size-6 text-amber-600" />
					<div>
						<h1 className="font-semibold text-xl">
							We could not verify your payment yet
						</h1>
						<p className="text-foreground/70 text-sm">
							The billing check failed due to a network or server
							error. Your payment may still have completed.
						</p>
					</div>
				</div>

				<Alert>
					<AlertDescription>
						Try again now. If you were charged, do not start another
						checkout until this status refreshes.
					</AlertDescription>
				</Alert>

				<div className="flex flex-wrap gap-2">
					<Button
						disabled={isCheckingNow}
						onClick={() => void statusQuery.refetch()}
					>
						{isCheckingNow ? (
							<Loader2Icon className="size-4 animate-spin" />
						) : (
							<RefreshCcwIcon className="size-4" />
						)}
						{isCheckingNow ? "Checking..." : "Retry verification"}
					</Button>
					<Button asChild variant="outline">
						<Link href={fallbackHref}>Back</Link>
					</Button>
				</div>
			</div>
		);
	}

	if (status === "active") {
		return (
			<div className="rounded-3xl border bg-background/90 p-6 text-center">
				<CheckCircle2Icon className="mx-auto mb-4 size-10 text-green-600" />
				<h1 className="font-semibold text-xl">Payment confirmed</h1>
				<p className="mt-2 text-foreground/70 text-sm">
					Redirecting you back to the app.
				</p>
			</div>
		);
	}

	if (status === "failed" || status === "cancelled") {
		return (
			<div className="space-y-4 rounded-3xl border bg-background/90 p-6">
				<div className="flex items-center gap-3">
					<AlertCircleIcon className="size-6 text-red-600" />
					<div>
						<h1 className="font-semibold text-xl">
							Checkout not completed
						</h1>
						<p className="text-foreground/70 text-sm">
							Your latest checkout did not activate access.
						</p>
					</div>
				</div>

				<Alert variant="destructive">
					<AlertDescription>
						Go back to billing and retry if needed. If you were
						charged, wait a few seconds and check again.
					</AlertDescription>
				</Alert>

				<div className="flex flex-wrap gap-2">
					<Button
						disabled={isCheckingNow}
						onClick={() => void statusQuery.refetch()}
					>
						{isCheckingNow ? (
							<Loader2Icon className="size-4 animate-spin" />
						) : (
							<RefreshCcwIcon className="size-4" />
						)}
						{isCheckingNow ? "Checking..." : "Check again"}
					</Button>
					<Button asChild variant="outline">
						<Link href={fallbackHref}>Back</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4 rounded-3xl border bg-background/90 p-6">
			<div className="flex items-center gap-3">
				<Loader2Icon className="size-6 animate-spin text-primary" />
				<div>
					<h1 className="font-semibold text-xl">Verifying payment</h1>
					<p className="text-foreground/70 text-sm">
						Waiting for billing confirmation before we send you
						back.
					</p>
				</div>
			</div>

			{hasTimedOut ? (
				<Alert>
					<AlertDescription>
						Confirmation is taking longer than expected. This is
						usually a webhook delay, not a lost payment.
					</AlertDescription>
				</Alert>
			) : (
				<div className="rounded-2xl border border-dashed px-4 py-3 text-foreground/65 text-sm">
					This page will refresh automatically for up to 30 seconds.
				</div>
			)}

			<div className="flex flex-wrap gap-2">
				<Button
					disabled={isCheckingNow}
					onClick={() => void statusQuery.refetch()}
				>
					{isCheckingNow ? (
						<Loader2Icon className="size-4 animate-spin" />
					) : (
						<RefreshCcwIcon className="size-4" />
					)}
					{isCheckingNow ? "Checking..." : "Check now"}
				</Button>
				<Button asChild variant="outline">
					<Link href={fallbackHref}>
						{hasTimedOut ? "Back to billing" : "Leave this page"}
					</Link>
				</Button>
			</div>
		</div>
	);
}
