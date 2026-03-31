"use client";

import type { NotificationPreferences } from "@repo/api/modules/studio/schemas/notification";
import { Button } from "@repo/ui/components/button";
import { Switch } from "@repo/ui/components/switch";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { notificationsApi, notificationsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const preferenceGroups = [
	{
		title: "Who should hear from the app",
		items: [
			{
				key: "assignedToMe",
				label: "Assigned to me",
				description:
					"Assignments and workflow updates on items I’m responsible for.",
			},
			{
				key: "itemsIAssigned",
				label: "Items I assigned",
				description:
					"Progress updates on work I handed off to someone else.",
			},
			{
				key: "bookingsIOwn",
				label: "Bookings I own",
				description:
					"High-signal task, shoot, and deliverable updates under my bookings.",
			},
			{
				key: "itemsIFollow",
				label: "Items I follow",
				description:
					"Updates on tasks, shoots, and deliverables I’ve subscribed to.",
			},
		],
	},
	{
		title: "Signals",
		items: [
			{
				key: "mentions",
				label: "Mentions",
				description:
					"Direct callouts for me in discussions and review flows.",
			},
			{
				key: "dueOverdueReminders",
				label: "Due and overdue reminders",
				description: "Upcoming deadline nudges and overdue alerts.",
			},
		],
	},
] as const satisfies ReadonlyArray<{
	title: string;
	items: ReadonlyArray<{
		key: keyof NotificationPreferences;
		label: string;
		description: string;
	}>;
}>;

export function NotificationPreferencesForm() {
	const queryClient = useQueryClient();
	const preferencesQuery = useQuery({
		...notificationsApi.preferencesOptions(),
		refetchOnWindowFocus: false,
	});
	const updateMutation = useMutation({
		...notificationsMutations.updatePreferences(),
		onSuccess: (result) => {
			queryClient.setQueryData(
				orpc.notifications.getPreferences.key(),
				result,
			);
			setLastSaved(result.data);
			setDraft(result.data);
			toast.success("Notification preferences updated");
		},
		onError: (error) => {
			toast.error(
				error.message || "Failed to update notification preferences",
			);
		},
	});
	const [draft, setDraft] = useState<NotificationPreferences | null>(null);
	const [lastSaved, setLastSaved] = useState<NotificationPreferences | null>(
		null,
	);

	useEffect(() => {
		if (preferencesQuery.data?.data && lastSaved === null) {
			setDraft(preferencesQuery.data.data);
			setLastSaved(preferencesQuery.data.data);
		}
	}, [lastSaved, preferencesQuery.data]);

	const isLoading = preferencesQuery.isLoading || draft === null;
	const isDirty =
		draft !== null &&
		lastSaved !== null &&
		Object.keys(draft).some((key) => {
			const preferenceKey = key as keyof NotificationPreferences;
			return draft[preferenceKey] !== lastSaved[preferenceKey];
		});

	return (
		<div className="divide-y divide-border">
			<SettingsItem
				title="In-app notifications"
				description="Control who can reach you inside Studio. Email and WhatsApp stay out of this phase."
			>
				<div className="space-y-6 rounded-2xl border border-border bg-card p-5">
					{preferencesQuery.isError && draft === null ? (
						<div className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
							<p className="text-sm font-medium text-foreground">
								Unable to load notification preferences.
							</p>
							<p className="text-sm text-muted-foreground">
								Check that migrations are up to date, then
								retry.
							</p>
							<div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => preferencesQuery.refetch()}
								>
									Retry
								</Button>
							</div>
						</div>
					) : isLoading ? (
						<p className="text-sm text-muted-foreground">
							Loading notification preferences...
						</p>
					) : (
						preferenceGroups.map((group) => (
							<div key={group.title} className="space-y-3">
								<h3 className="text-sm font-semibold text-foreground">
									{group.title}
								</h3>
								<div className="space-y-2">
									{group.items.map((item) => (
										<div
											key={item.key}
											className="flex items-start justify-between gap-4 rounded-xl border border-border/70 px-4 py-3"
										>
											<div className="space-y-1">
												<p className="text-sm font-medium text-foreground">
													{item.label}
												</p>
												<p className="text-sm text-muted-foreground">
													{item.description}
												</p>
											</div>
											<Switch
												checked={draft[item.key]}
												onCheckedChange={(checked) => {
													setDraft((current) =>
														current
															? {
																	...current,
																	[item.key]:
																		checked,
																}
															: current,
													);
												}}
											/>
										</div>
									))}
								</div>
							</div>
						))
					)}

					<div className="flex justify-end">
						<Button
							type="button"
							onClick={() => {
								if (draft) {
									updateMutation.mutate(draft);
								}
							}}
							disabled={
								!isDirty ||
								updateMutation.isPending ||
								draft === null
							}
						>
							Save preferences
						</Button>
					</div>
				</div>
			</SettingsItem>
		</div>
	);
}
