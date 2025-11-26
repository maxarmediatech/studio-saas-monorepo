"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@repo/ui/components/button";

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Surface the error for observability tools
		console.error("Choose plan route crashed", {
			error,
			digest: error.digest,
		});
	}, [error]);

	return (
		<div className="min-h-screen bg-gradient-to-b from-background via-background to-muted text-foreground">
			<div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-10">
				<div className="w-full max-w-3xl space-y-6 rounded-3xl border bg-card/80 p-8 shadow-xl backdrop-blur">
					<div className="flex items-center gap-3">
						<span className="rounded-full bg-destructive/10 p-3 text-destructive">
							<AlertTriangle className="h-5 w-5" />
						</span>
						<div className="space-y-1">
							<p className="text-xs font-semibold uppercase tracking-[0.2em] text-destructive">
								Application error
							</p>
							<h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
								Something went wrong while loading this page.
							</h1>
						</div>
					</div>

					<p className="text-muted-foreground">
						An unexpected server issue blocked this step. You can
						retry, return home, or choose another path below.
					</p>

					<div className="flex flex-wrap items-center gap-3">
						<Button onClick={reset} className="gap-2">
							<RotateCcw className="h-4 w-4" aria-hidden />
							Try again
						</Button>
						<Button variant="secondary" asChild className="gap-2">
							<Link href="/app">
								<Home className="h-4 w-4" aria-hidden />
								Back home
							</Link>
						</Button>
					</div>

					<details className="group rounded-2xl border bg-muted/60 p-4 text-sm text-muted-foreground">
						<summary className="cursor-pointer list-none font-medium text-foreground">
							Technical details
						</summary>
						<div className="mt-2 space-y-2">
							{error.message ? (
								<p className="font-mono text-xs text-foreground/80">
									{error.message}
								</p>
							) : null}
							{error.digest ? (
								<p className="font-mono text-xs text-foreground/60">
									Reference: {error.digest}
								</p>
							) : null}
						</div>
					</details>
				</div>
			</div>
		</div>
	);
}
