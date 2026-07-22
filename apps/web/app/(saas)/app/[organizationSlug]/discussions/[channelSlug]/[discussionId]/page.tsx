"use client";

import type { DiscussionLinkEntityType } from "@repo/api/modules/discussions/schemas";
import type { EditorContentJson } from "@repo/editor";
import { LiteRichTextEditor, ReadOnlyRenderer } from "@repo/editor";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
} from "@repo/ui/components/input-group";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useSession } from "@saas/auth/hooks/use-session";
import { ENTITY_TYPE_CONFIG } from "@saas/studio/components/discussions/entity-link-picker";
import { ThreadCard } from "@saas/studio/components/thread";
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

const EMPTY_DOC: EditorContentJson = {
	type: "doc",
	content: [{ type: "paragraph" }],
};

function isEditorContentJson(value: unknown): value is EditorContentJson {
	if (typeof value !== "object" || value === null) return false;
	const record = value as Record<string, unknown>;
	return record.type === "doc";
}

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
		...tasksApi.listMinimalOptions({}),
		staleTime: 60000,
	});
	const { data: schedulesData } = useQuery({
		...studioPaymentsApi.listSchedulesMinimalOptions({}),
		staleTime: 60000,
	});
	const { data: expensesData } = useQuery({
		...expensesApi.listMinimalOptions({}),
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
			lookup.payment_schedule[s.id] = s.name;
		}
		for (const e of expensesData?.data ?? []) {
			lookup.expense[e.id] = e.description;
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

export default function DiscussionDetailPage() {
	const params = useParams<{
		organizationSlug: string;
		channelSlug: string;
		discussionId: string;
	}>();
	const { user } = useSession();
	const queryClient = useQueryClient();
	const [newThreadDoc, setNewThreadDoc] =
		useState<EditorContentJson>(EMPTY_DOC);
	const [newThreadText, setNewThreadText] = useState("");
	const [linksOpen, setLinksOpen] = useState(false);
	const entityNameLookup = useEntityNameLookup();

	const { data: discussionData, isLoading: discussionLoading } = useQuery(
		discussionsApi.getDiscussionOptions(
			params.organizationSlug,
			params.discussionId,
		),
	);

	const discussion = discussionData?.data;

	const { data: messagesData, isLoading: messagesLoading } = useQuery({
		...discussionsApi.listMessagesOptions({
			organizationSlug: params.organizationSlug,
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
			setNewThreadDoc(EMPTY_DOC);
			setNewThreadText("");
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
		if (!newThreadText.trim()) return;
		createMessageMutation.mutate({
			organizationSlug: params.organizationSlug,
			discussionId: params.discussionId,
			contentJson: newThreadDoc,
		});
	};

	const handleReply = (parentId: string, contentJson: EditorContentJson) => {
		createMessageMutation.mutate({
			organizationSlug: params.organizationSlug,
			discussionId: params.discussionId,
			contentJson,
			parentId,
		});
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
									organizationSlug: params.organizationSlug,
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
									organizationSlug: params.organizationSlug,
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

				{isEditorContentJson(discussion.contentJson) ? (
					<div className="mt-6">
						<ReadOnlyRenderer
							content={discussion.contentJson}
							className="text-foreground"
						/>
					</div>
				) : discussion.content ? (
					<p className="mt-6 text-foreground whitespace-pre-wrap">
						{discussion.content}
					</p>
				) : null}

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

				<div className="mt-4">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<UserAvatar
							name={discussion.author?.name ?? "Unknown"}
							avatarUrl={discussion.author?.image}
							className="size-5"
						/>
						<span>
							{discussion.author?.name ?? "Unknown"} created this
							post
						</span>
						<span>·</span>
						<span>
							{formatDistanceToNow(
								new Date(discussion.createdAt),
								{
									addSuffix: true,
								},
							)}
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
									onReplySubmit={handleReply}
									isSubmitting={
										createMessageMutation.isPending
									}
								/>
							))
						)}
					</div>
				</div>

				<InputGroup className="mt-6 bg-card">
					<LiteRichTextEditor
						value={newThreadDoc}
						onChange={(payload) => {
							setNewThreadDoc(payload.json);
							setNewThreadText(payload.text);
						}}
						onSubmit={handleNewThread}
						placeholder="Join the conversation..."
						editable={!createMessageMutation.isPending}
						className="min-h-[80px] w-full resize-none bg-transparent px-3 py-3 text-sm outline-none"
					/>
					<InputGroupAddon align="block-end">
						<InputGroupButton
							className="ml-auto"
							size="sm"
							variant="default"
							onClick={handleNewThread}
							disabled={
								!newThreadText.trim() ||
								createMessageMutation.isPending
							}
						>
							<Send className="size-4" />
							Send
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
			</div>
		</div>
	);
}
