"use client";

import type { DiscussionLinkEntityType } from "@repo/api/modules/discussions/schemas";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { Input } from "@repo/ui/components/input";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useSession } from "@saas/auth/hooks/use-session";
import { ENTITY_TYPE_CONFIG } from "@saas/studio/components/discussions/entity-link-picker";
import {
	bookingsApi,
	deliverablesApi,
	discussionsApi,
	discussionsMutations,
	expensesApi,
	shootsApi,
	studioPaymentsApi,
	tasksApi,
} from "@saas/studio/lib/api";
import { UserAvatar } from "@shared/components/UserAvatar";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
	CheckCircle,
	ChevronRight,
	Hash,
	MoreHorizontal,
	Plus,
	Send,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function useEntityNameLookup() {
	const { data: bookingsData } = useQuery({
		...bookingsApi.listMinimalOptions({}),
		staleTime: 60000,
	});
	const { data: shootsData } = useQuery({
		...shootsApi.listMinimalOptions({}),
		staleTime: 60000,
	});
	const { data: deliverablesData } = useQuery({
		...deliverablesApi.listMinimalOptions({}),
		staleTime: 60000,
	});
	const { data: tasksData } = useQuery({
		...tasksApi.listOptions({}),
		staleTime: 60000,
	});
	const { data: schedulesData } = useQuery({
		...studioPaymentsApi.listSchedulesOptions({}),
		staleTime: 60000,
	});
	const { data: expensesData } = useQuery({
		...expensesApi.listOptions({}),
		staleTime: 60000,
	});

	return useMemo(() => {
		const lookup: Record<string, Record<string, string>> = {
			booking: {},
			shoot: {},
			deliverable: {},
			task: {},
			payment_schedule: {},
			expense: {},
		};

		for (const b of bookingsData?.data ?? []) {
			lookup.booking[b.id] = b.name;
		}
		for (const s of shootsData?.data ?? []) {
			lookup.shoot[s.id] = s.name;
		}
		for (const d of deliverablesData?.data ?? []) {
			lookup.deliverable[d.id] = d.name;
		}
		for (const t of tasksData?.data ?? []) {
			lookup.task[t.id] = t.name;
		}
		for (const s of schedulesData?.data ?? []) {
			lookup.payment_schedule[s.id] = s.name || `Payment $${s.amount}`;
		}
		for (const e of expensesData?.data ?? []) {
			lookup.expense[e.id] = e.description || `Expense $${e.amount}`;
		}

		return lookup;
	}, [
		bookingsData,
		shootsData,
		deliverablesData,
		tasksData,
		schedulesData,
		expensesData,
	]);
}

interface ThreadCardProps {
	message: {
		id: string;
		content: string;
		createdAt: Date | string;
		replyCount: number;
		author?: {
			id: string;
			name: string | null;
			image: string | null;
		} | null;
		replies?: Array<{
			id: string;
			content: string;
			createdAt: Date | string;
			author?: {
				id: string;
				name: string | null;
				image: string | null;
			} | null;
		}>;
	};
	discussionId: string;
	onReplySubmit: (parentId: string, content: string) => void;
	isSubmitting: boolean;
}

function ThreadCard({
	message,
	discussionId,
	onReplySubmit,
	isSubmitting,
}: ThreadCardProps) {
	const { user } = useSession();
	const [replyContent, setReplyContent] = useState("");
	const [showReplyInput, setShowReplyInput] = useState(false);

	const handleSubmitReply = () => {
		if (!replyContent.trim()) return;
		onReplySubmit(message.id, replyContent.trim());
		setReplyContent("");
		setShowReplyInput(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmitReply();
		}
		if (e.key === "Escape") {
			setShowReplyInput(false);
			setReplyContent("");
		}
	};

	const allMessages = [message, ...(message.replies ?? [])];

	return (
		<div className="rounded-lg border bg-card">
			{allMessages.map((msg, index) => (
				<div
					key={msg.id}
					className={cn("p-4", index > 0 && "border-t")}
				>
					<div className="flex items-start gap-3">
						<UserAvatar
							name={msg.author?.name ?? "Unknown"}
							avatarUrl={msg.author?.image}
							className="size-8"
						/>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<span className="font-medium text-sm">
									{msg.author?.name ?? "Unknown"}
								</span>
								<span className="text-xs text-muted-foreground">
									{formatDistanceToNow(
										new Date(msg.createdAt),
										{
											addSuffix: true,
										},
									)}
								</span>
							</div>
							<p className="mt-1 text-sm text-foreground">
								{msg.content}
							</p>
						</div>
					</div>
				</div>
			))}

			{message.replyCount > (message.replies?.length ?? 0) && (
				<div className="border-t px-4 py-2">
					<button
						type="button"
						className="text-xs text-muted-foreground hover:text-foreground"
					>
						View{" "}
						{message.replyCount - (message.replies?.length ?? 0)}{" "}
						more{" "}
						{message.replyCount - (message.replies?.length ?? 0) ===
						1
							? "reply"
							: "replies"}
					</button>
				</div>
			)}

			<div className="border-t p-3">
				{showReplyInput ? (
					<div className="flex items-center gap-2">
						<UserAvatar
							name={user?.name ?? "You"}
							avatarUrl={user?.image}
							className="size-6"
						/>
						<Input
							placeholder="Write a reply..."
							value={replyContent}
							onChange={(e) => setReplyContent(e.target.value)}
							onKeyDown={handleKeyDown}
							className="h-8 text-sm"
							autoFocus
							disabled={isSubmitting}
						/>
						<Button
							size="sm"
							onClick={handleSubmitReply}
							disabled={!replyContent.trim() || isSubmitting}
							className="h-8 px-3"
						>
							<Send className="size-3" />
						</Button>
					</div>
				) : (
					<button
						type="button"
						onClick={() => setShowReplyInput(true)}
						className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
					>
						<UserAvatar
							name={user?.name ?? "You"}
							avatarUrl={user?.image}
							className="size-6"
						/>
						<span>Reply...</span>
					</button>
				)}
			</div>
		</div>
	);
}

export default function DiscussionDetailPage() {
	const params = useParams<{
		organizationSlug: string;
		channelSlug: string;
		discussionId: string;
	}>();
	const { user } = useSession();
	const queryClient = useQueryClient();
	const [newThreadContent, setNewThreadContent] = useState("");
	const [linksOpen, setLinksOpen] = useState(false);
	const entityNameLookup = useEntityNameLookup();

	const { data: discussionData, isLoading: discussionLoading } = useQuery(
		discussionsApi.getDiscussionOptions(params.discussionId),
	);

	const discussion = discussionData?.data;

	const { data: messagesData, isLoading: messagesLoading } = useQuery({
		...discussionsApi.listMessagesOptions({
			discussionId: params.discussionId,
		}),
		enabled: !!params.discussionId,
	});

	const messages = messagesData?.data ?? [];

	const participants = useMemo(() => {
		const participantMap = new Map<
			string,
			{ id: string; name: string | null; image: string | null }
		>();

		if (discussion?.author?.id) {
			participantMap.set(discussion.author.id, discussion.author);
		}

		for (const message of messages) {
			const author = (
				message as {
					author?: {
						id: string;
						name: string | null;
						image: string | null;
					};
				}
			).author;
			if (author?.id) {
				participantMap.set(author.id, author);
			}
			const replies = (
				message as {
					replies?: Array<{
						author?: {
							id: string;
							name: string | null;
							image: string | null;
						};
					}>;
				}
			).replies;
			for (const reply of replies ?? []) {
				if (reply.author?.id) {
					participantMap.set(reply.author.id, reply.author);
				}
			}
		}

		return Array.from(participantMap.values());
	}, [discussion?.author, messages]);

	const createMessageMutation = useMutation({
		...discussionsMutations.createMessage(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.discussions.listMessages.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.discussions.getDiscussion.key(),
			});
			setNewThreadContent("");
		},
		onError: () => {
			toast.error("Failed to send message");
		},
	});

	const resolveMutation = useMutation({
		...discussionsMutations.resolveDiscussion(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.discussions.getDiscussion.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.discussions.listDiscussions.key(),
			});
			toast.success("Discussion resolved");
		},
		onError: () => {
			toast.error("Failed to resolve discussion");
		},
	});

	const reopenMutation = useMutation({
		...discussionsMutations.reopenDiscussion(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.discussions.getDiscussion.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.discussions.listDiscussions.key(),
			});
			toast.success("Discussion reopened");
		},
		onError: () => {
			toast.error("Failed to reopen discussion");
		},
	});

	const handleNewThread = () => {
		if (!newThreadContent.trim()) return;
		createMessageMutation.mutate({
			discussionId: params.discussionId,
			content: newThreadContent.trim(),
		});
	};

	const handleReply = (parentId: string, content: string) => {
		createMessageMutation.mutate({
			discussionId: params.discussionId,
			content,
			parentId,
		});
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleNewThread();
		}
	};

	const channelHref = `/app/${params.organizationSlug}/discussions/${params.channelSlug}`;

	const getEntityName = (entityType: string, entityId: string): string => {
		return entityNameLookup[entityType]?.[entityId] ?? entityType;
	};

	if (discussionLoading) {
		return (
			<div className="mx-auto w-full max-w-[800px] py-6">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="mt-8 h-8 w-96" />
				<Skeleton className="mt-4 h-4 w-64" />
				<Skeleton className="mt-6 h-24 w-full" />
			</div>
		);
	}

	if (!discussion) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-muted-foreground">
					Discussion not found
				</div>
			</div>
		);
	}

	const linksCount = discussion.links?.length ?? 0;

	return (
		<div className="mx-auto w-full max-w-[800px] py-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm">
					<Link
						href={channelHref}
						className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
					>
						<Hash className="size-4" />
						{discussion.channel?.name ?? params.channelSlug}
					</Link>
					<ChevronRight className="size-4 text-muted-foreground" />
					<span className="font-medium text-foreground truncate max-w-[300px]">
						{discussion.title}
					</span>
					{discussion.status === "resolved" && (
						<span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
							<CheckCircle className="size-3" />
							Resolved
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					{discussion.status === "open" ? (
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								resolveMutation.mutate({
									discussionId: params.discussionId,
									resolution: "Marked as resolved",
								})
							}
							disabled={resolveMutation.isPending}
						>
							<CheckCircle className="mr-1 size-4" />
							Resolve
						</Button>
					) : (
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								reopenMutation.mutate({
									discussionId: params.discussionId,
								})
							}
							disabled={reopenMutation.isPending}
						>
							Reopen
						</Button>
					)}
					<Button variant="ghost" size="icon" className="size-8">
						<MoreHorizontal className="size-4" />
					</Button>
				</div>
			</div>

			<div className="mt-8">
				<h1 className="text-2xl font-semibold">{discussion.title}</h1>
				<div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
					<span>by</span>
					<UserAvatar
						name={discussion.author?.name ?? "Unknown"}
						avatarUrl={discussion.author?.image}
						className="size-5"
					/>
					<span className="font-medium text-foreground">
						{discussion.author?.name ?? "Unknown"}
					</span>
					<span>in</span>
					<Hash className="size-3" />
					<span>{discussion.channel?.name}</span>
					<span>on</span>
					<span>
						{format(
							new Date(discussion.createdAt),
							"d MMM yyyy, HH:mm",
						)}
					</span>
				</div>

				{discussion.content && (
					<p className="mt-6 text-foreground whitespace-pre-wrap">
						{discussion.content}
					</p>
				)}

				{linksCount > 0 && (
					<div className="mt-4 flex flex-wrap gap-2">
						{discussion.links?.map((link) => {
							const config =
								ENTITY_TYPE_CONFIG[
									link.entityType as DiscussionLinkEntityType
								];
							if (!config) return null;
							const entityName = getEntityName(
								link.entityType,
								link.entityId,
							);
							return (
								<Badge
									key={link.id}
									variant="secondary"
									className={cn(
										"flex items-center gap-1.5",
										config.color,
									)}
								>
									{config.icon}
									<span>{entityName}</span>
								</Badge>
							);
						})}
					</div>
				)}

				<div className="mt-6 border-t pt-4">
					<Collapsible open={linksOpen} onOpenChange={setLinksOpen}>
						<div className="flex items-center justify-between">
							<CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
								<ChevronRight
									className={cn(
										"size-4 transition-transform",
										linksOpen && "rotate-90",
									)}
								/>
								Related Items ({linksCount})
							</CollapsibleTrigger>
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
							>
								<Plus className="size-4" />
							</Button>
						</div>
						<CollapsibleContent className="mt-2">
							{linksCount === 0 ? (
								<p className="text-sm text-muted-foreground py-2">
									No related items linked to this discussion.
								</p>
							) : (
								<div className="space-y-1">
									{discussion.links?.map((link) => {
										const config =
											ENTITY_TYPE_CONFIG[
												link.entityType as DiscussionLinkEntityType
											];
										if (!config) return null;
										const entityName = getEntityName(
											link.entityType,
											link.entityId,
										);
										return (
											<div
												key={link.id}
												className="flex items-center gap-2 py-1 text-sm"
											>
												{config.icon}
												<span>{entityName}</span>
												<span className="text-muted-foreground">
													({config.label})
												</span>
											</div>
										);
									})}
								</div>
							)}
						</CollapsibleContent>
					</Collapsible>
				</div>
			</div>

			{discussion.status === "resolved" && discussion.resolution && (
				<div className="mt-6 rounded-lg bg-green-50 p-4">
					<div className="flex items-start gap-3">
						<CheckCircle className="size-5 shrink-0 text-green-600" />
						<div>
							<div className="font-medium text-green-900">
								Resolution
							</div>
							<div className="mt-1 text-sm text-green-800 whitespace-pre-wrap">
								{discussion.resolution}
							</div>
						</div>
					</div>
				</div>
			)}

			<div className="mt-8 border-t pt-6">
				<div className="flex items-center justify-between">
					<h2 className="font-semibold">Activity</h2>
					<div className="flex items-center gap-1">
						{participants.slice(0, 5).map((participant) => (
							<UserAvatar
								key={participant.id}
								name={participant.name ?? "Unknown"}
								avatarUrl={participant.image}
								className="size-6 -ml-1 first:ml-0 ring-2 ring-background"
							/>
						))}
						{participants.length > 5 && (
							<span className="ml-1 text-xs text-muted-foreground">
								+{participants.length - 5}
							</span>
						)}
					</div>
				</div>

				<div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
					<UserAvatar
						name={discussion.author?.name ?? "Unknown"}
						avatarUrl={discussion.author?.image}
						className="size-5"
					/>
					<span>
						{discussion.author?.name ?? "Unknown"} created this post
					</span>
					<span>·</span>
					<span>
						{formatDistanceToNow(new Date(discussion.createdAt), {
							addSuffix: true,
						})}
					</span>
				</div>

				<div className="mt-4 space-y-4">
					{messagesLoading ? (
						<>
							<Skeleton className="h-24 w-full rounded-lg" />
							<Skeleton className="h-24 w-full rounded-lg" />
						</>
					) : messages.length === 0 ? (
						<p className="text-sm text-muted-foreground py-4">
							No comments yet. Start the conversation!
						</p>
					) : (
						messages.map((message) => (
							<ThreadCard
								key={message.id}
								message={message}
								discussionId={params.discussionId}
								onReplySubmit={handleReply}
								isSubmitting={createMessageMutation.isPending}
							/>
						))
					)}
				</div>

				<div className="mt-6 rounded-lg border bg-card p-4">
					<div className="flex items-center gap-3">
						<UserAvatar
							name={user?.name ?? "You"}
							avatarUrl={user?.image}
							className="size-8"
						/>
						<Input
							placeholder="Join the conversation..."
							value={newThreadContent}
							onChange={(e) =>
								setNewThreadContent(e.target.value)
							}
							onKeyDown={handleKeyDown}
							className="flex-1"
							disabled={createMessageMutation.isPending}
						/>
						<Button
							onClick={handleNewThread}
							disabled={
								!newThreadContent.trim() ||
								createMessageMutation.isPending
							}
						>
							<Send className="size-4" />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
