"use client";

import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { ChannelSettingsDialog } from "@saas/studio/components/discussions";
import { discussionsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { Hash, Lock, MessageCircle, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DiscussionCreateForm } from "./discussion-create-form";

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

export default function ChannelPage() {
	const params = useParams<{
		organizationSlug: string;
		channelSlug: string;
	}>();
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [showSettings, setShowSettings] = useState(false);

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

	if (channelLoading) {
		return (
			<div className="flex flex-1 flex-col">
				<div className="flex h-14 items-center gap-3 border-b px-6">
					<Skeleton className="h-5 w-32" />
				</div>
				<div className="flex-1 p-6">
					<Skeleton className="h-20 w-full" />
				</div>
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
		<div className="flex flex-1 flex-col">
			<div className="flex h-14 shrink-0 items-center justify-between border-b px-6">
				<div className="flex items-center gap-2">
					{channel.emoji ? (
						<span className="text-lg">{channel.emoji}</span>
					) : channel.visibility === "private" ? (
						<Lock className="size-5 text-neutral-500" />
					) : (
						<Hash className="size-5 text-neutral-500" />
					)}
					<h1 className="font-semibold text-neutral-900">
						{channel.name}
					</h1>
				</div>
				<div className="flex items-center gap-2">
					<Button size="sm" onClick={() => setShowCreateForm(true)}>
						<Plus className="mr-1 size-4" />
						New Discussion
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						onClick={() => setShowSettings(true)}
					>
						<Settings className="size-4" />
					</Button>
				</div>
			</div>

			{channel.description && (
				<div className="border-b bg-neutral-50 px-6 py-3">
					<p className="text-sm text-neutral-600">
						{channel.description}
					</p>
				</div>
			)}

			{showCreateForm && (
				<div className="border-b p-6">
					<DiscussionCreateForm
						channelId={channel.id}
						onCancel={() => setShowCreateForm(false)}
						onSuccess={() => setShowCreateForm(false)}
					/>
				</div>
			)}

			<div className="flex-1 overflow-y-auto">
				{discussionsLoading ? (
					<div className="space-y-4 p-6">
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-16 w-full" />
					</div>
				) : discussions.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-4 p-12">
						<div className="rounded-full bg-neutral-100 p-4">
							<MessageCircle className="size-8 text-neutral-400" />
						</div>
						<div className="text-center">
							<h3 className="font-medium text-neutral-900">
								No discussions yet
							</h3>
							<p className="mt-1 text-sm text-neutral-500">
								Start the first discussion in this channel.
							</p>
						</div>
						<Button onClick={() => setShowCreateForm(true)}>
							Start Discussion
						</Button>
					</div>
				) : (
					<div className="divide-y">
						{groupedDiscussions.map((group) => (
							<div key={group.label}>
								<div className="sticky top-0 z-10 bg-white/95 px-6 py-2 backdrop-blur">
									<span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
										{group.label}
									</span>
								</div>
								<div className="divide-y">
									{group.items.map((discussion) => (
										<Link
											key={discussion.id}
											href={getDiscussionHref(
												discussion.id,
											)}
											className="block px-6 py-4 transition-colors hover:bg-neutral-50"
										>
											<div className="flex items-start justify-between gap-4">
												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-2">
														<h3 className="truncate font-medium text-neutral-900">
															{discussion.title}
														</h3>
														{discussion.status ===
															"resolved" && (
															<span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
																Resolved
															</span>
														)}
													</div>
													{discussion.content && (
														<p className="mt-1 line-clamp-2 text-sm text-neutral-600">
															{discussion.content}
														</p>
													)}
													<div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
														<span>
															{discussion.author
																?.name ??
																"Unknown"}
														</span>
														<span>
															{formatDistanceToNow(
																new Date(
																	discussion.createdAt,
																),
																{
																	addSuffix: true,
																},
															)}
														</span>
														{discussion.messageCount >
															0 && (
															<span className="flex items-center gap-1">
																<MessageCircle className="size-3" />
																{
																	discussion.messageCount
																}
															</span>
														)}
													</div>
												</div>
											</div>
										</Link>
									))}
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			<ChannelSettingsDialog
				open={showSettings}
				onOpenChange={setShowSettings}
				channel={{
					id: channel.id,
					name: channel.name,
					slug: channel.slug,
					description: channel.description,
					emoji: channel.emoji,
					visibility: channel.visibility,
				}}
				organizationSlug={params.organizationSlug}
			/>
		</div>
	);
}
