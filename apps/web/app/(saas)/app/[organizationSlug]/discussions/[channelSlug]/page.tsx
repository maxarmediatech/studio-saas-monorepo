"use client";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";

import { ChannelSettingsDialog } from "@saas/studio/components/discussions";
import { discussionsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import { BellOff, Hash, MessageCircle, Settings } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function groupDiscussionsByDate<T extends { createdAt: Date | string }>(
	discussions: T[],
): { label: string; items: T[] }[] {
	const groups: Record<string, T[]> = {};

	for (const discussion of discussions) {
		const date = new Date(discussion.createdAt);
		let label: string;

		if (isToday(date)) {
			label = "Today";
		} else if (isYesterday(date)) {
			label = "Yesterday";
		} else {
			label = format(date, "MMMM d, yyyy");
		}

		if (!groups[label]) {
			groups[label] = [];
		}
		groups[label].push(discussion);
	}

	return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

function UserAvatar({
	name,
	className,
}: {
	name?: string | null;
	className?: string;
}) {
	const initial = name?.charAt(0)?.toUpperCase() ?? "?";
	return (
		<div
			className={cn(
				"flex shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-medium text-neutral-600",
				className,
			)}
		>
			{initial}
		</div>
	);
}

export default function ChannelPage() {
	const params = useParams<{
		organizationSlug: string;
		channelSlug: string;
	}>();
	const router = useRouter();
	const [showSettings, setShowSettings] = useState(false);
	const [composerValue, setComposerValue] = useState("");

	const { data: channelData, isLoading: channelLoading } = useQuery(
		discussionsApi.getChannelBySlugOptions(params.channelSlug),
	);

	const channel = channelData?.data;

	const { data: discussionsData, isLoading: discussionsLoading } = useQuery({
		...discussionsApi.listDiscussionsOptions({
			channelId: channel?.id ?? "",
			limit: 50,
		}),
		enabled: !!channel?.id,
	});

	const discussions = discussionsData?.data ?? [];
	const groupedDiscussions = useMemo(
		() => groupDiscussionsByDate(discussions),
		[discussions],
	);

	const handleComposerClick = () => {
		router.push(
			`/app/${params.organizationSlug}/discussions/${params.channelSlug}/new`,
		);
	};

	if (channelLoading) {
		return (
			<div className="mx-auto w-full max-w-[800px]">
				<Skeleton className="h-10 w-48" />
				<Skeleton className="mt-2 h-4 w-24" />
				<Skeleton className="mt-8 h-14 w-full rounded-xl" />
			</div>
		);
	}

	if (!channel) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-neutral-500">Channel not found</div>
			</div>
		);
	}

	const getDiscussionHref = (discussionId: string) =>
		`/app/${params.organizationSlug}/discussions/${params.channelSlug}/${discussionId}`;

	return (
		<>
			<div className="mx-auto w-full max-w-[800px]">
				<div className="flex items-start justify-between pb-6 pt-2">
					<div>
						<div className="flex items-center gap-3">
							<Hash className="size-8 text-neutral-400" />
							<h1 className="text-2xl font-semibold text-neutral-900">
								{channel.name}
							</h1>
						</div>
						<p className="mt-1 text-sm text-neutral-500">
							0 people
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							className="size-9"
							onClick={() => setShowSettings(true)}
						>
							<Settings className="size-4" />
						</Button>
						<Button variant="outline" size="sm" className="gap-2">
							<BellOff className="size-4" />
							Unsubscribed
						</Button>
					</div>
				</div>

				<button
					type="button"
					className="flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-white p-3 text-left transition-colors hover:border-neutral-300"
					onClick={handleComposerClick}
				>
					<UserAvatar name="You" className="size-10" />
					<Input
						placeholder={`Start a discussion in ${channel.name}`}
						className="pointer-events-none flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
						readOnly
					/>
					<span className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
						Post
					</span>
				</button>

				<div className="mt-8">
					{discussionsLoading ? (
						<div className="space-y-4">
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
						</div>
					) : discussions.length === 0 ? (
						<div className="py-12 text-center">
							<MessageCircle className="mx-auto size-10 text-neutral-300" />
							<p className="mt-3 text-sm text-neutral-500">
								No discussions yet. Start the first one!
							</p>
						</div>
					) : (
						<div className="space-y-6">
							{groupedDiscussions.map((group) => (
								<div key={group.label}>
									<div className="mb-3 text-xs font-medium text-neutral-500">
										{group.label}
									</div>
									<div className="space-y-1">
										{group.items.map((discussion) => (
											<Link
												key={discussion.id}
												href={getDiscussionHref(
													discussion.id,
												)}
												className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-neutral-50"
											>
												<UserAvatar
													name={
														discussion.author?.name
													}
													className="size-10"
												/>
												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-2">
														<span className="font-medium text-neutral-900">
															{discussion.title}
														</span>
														{discussion.status ===
															"resolved" && (
															<span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
																Resolved
															</span>
														)}
													</div>
													<p className="mt-0.5 text-sm text-neutral-500">
														<span className="text-neutral-700">
															{discussion.author
																?.name ??
																"Unknown"}
														</span>
														{discussion.content && (
															<>
																:{" "}
																<span className="text-neutral-500">
																	{discussion
																		.content
																		.length >
																	60
																		? `${discussion.content.slice(0, 60)}...`
																		: discussion.content}
																</span>
															</>
														)}
													</p>
												</div>
												{discussion.messageCount >
													0 && (
													<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
														{
															discussion.messageCount
														}
													</span>
												)}
											</Link>
										))}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			<ChannelSettingsDialog
				open={showSettings}
				onOpenChange={setShowSettings}
				channel={{
					id: channel.id,
					name: channel.name,
					slug: channel.slug,
					description: channel.description,
				}}
				organizationSlug={params.organizationSlug}
			/>
		</>
	);
}
