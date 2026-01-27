"use client";

import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import {
	CalendarDaysIcon,
	CheckCircle2Icon,
	LinkIcon,
	UnlinkIcon,
} from "lucide-react";
import * as React from "react";

type GoogleCalendarStatus = {
	connected: boolean;
	googleAccountEmail?: string | null;
};

async function fetchGoogleCalendarStatus(): Promise<GoogleCalendarStatus> {
	const res = await fetch("/api/integrations/google-calendar/status", {
		method: "GET",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
	});
	if (!res.ok) {
		return { connected: false };
	}
	return (await res.json()) as GoogleCalendarStatus;
}

export function GoogleCalendarIntegrationCard() {
	const [status, setStatus] = React.useState<GoogleCalendarStatus | null>(
		null,
	);
	const [isLoading, setIsLoading] = React.useState(true);
	const [isDisconnecting, setIsDisconnecting] = React.useState(false);

	React.useEffect(() => {
		let isMounted = true;
		setIsLoading(true);
		fetchGoogleCalendarStatus()
			.then((data) => {
				if (isMounted) {
					setStatus(data);
				}
			})
			.finally(() => {
				if (isMounted) {
					setIsLoading(false);
				}
			});
		return () => {
			isMounted = false;
		};
	}, []);

	const disconnect = async () => {
		setIsDisconnecting(true);
		try {
			await fetch("/api/integrations/google-calendar/disconnect", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
			});
		} finally {
			setIsDisconnecting(false);
			setStatus(await fetchGoogleCalendarStatus());
		}
	};

	const connected = Boolean(status?.connected);

	return (
		<SettingsItem
			title={
				<span className="inline-flex items-center gap-2">
					<CalendarDaysIcon className="size-4 text-primary/60" />
					Google Calendar
				</span>
			}
			description={
				"When you’re assigned to a shoot, we’ll create an all-day calendar entry."
			}
		>
			<div className="flex flex-col gap-3">
				{isLoading ? (
					<div className="flex items-center justify-between gap-2">
						<Skeleton className="h-4 w-64" />
						<Skeleton className="h-10 w-28" />
					</div>
				) : connected ? (
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between gap-2">
							<div className="flex items-center gap-2 text-sm">
								<CheckCircle2Icon className="size-5 text-success" />
								<span>
									Connected
									{status?.googleAccountEmail
										? ` as ${status.googleAccountEmail}`
										: ""}
								</span>
							</div>
							<Button
								variant="outline"
								disabled={isDisconnecting}
								onClick={disconnect}
							>
								<UnlinkIcon className="mr-1.5 size-4" />
								Disconnect
							</Button>
						</div>
						<p className="m-0 text-xs text-foreground/60">
							Calendar sync is always on for you once connected.
						</p>
					</div>
				) : (
					<div className="flex items-center justify-between gap-2">
						<p className="m-0 text-sm text-foreground/70">
							Not connected.
						</p>
						<Button asChild variant="ghost">
							<a href="/api/integrations/google-calendar/connect">
								<LinkIcon className="mr-1.5 size-4" />
								Connect
							</a>
						</Button>
					</div>
				)}
			</div>
		</SettingsItem>
	);
}
