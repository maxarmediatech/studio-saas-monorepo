"use client";

import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { AlertCircleIcon, RefreshCcwIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function CheckoutCompleteError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div className="mx-auto max-w-2xl space-y-4 p-6 lg:p-8">
			<div className="rounded-3xl border bg-background/90 p-6">
				<div className="flex items-center gap-3">
					<AlertCircleIcon className="size-6 text-red-600" />
					<div>
						<h1 className="font-semibold text-xl">
							Checkout confirmation hit an error
						</h1>
						<p className="text-foreground/70 text-sm">
							Try the confirmation step again before starting a
							new checkout.
						</p>
					</div>
				</div>

				<Alert className="mt-4">
					<AlertDescription>
						If you were charged, do not retry payment immediately.
						Refresh confirmation first.
					</AlertDescription>
				</Alert>

				<div className="mt-4 flex flex-wrap gap-2">
					<Button onClick={() => reset()}>
						<RefreshCcwIcon className="size-4" />
						Try again
					</Button>
					<Button asChild variant="outline">
						<Link href="/choose-plan">Back to billing</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
