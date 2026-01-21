"use client";

import type { DiscussionLinkEntityType } from "@repo/api/modules/discussions/schemas";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";
import { ENTITY_TYPE_CONFIG } from "@saas/studio/components/discussions/entity-link-picker";
import { discussionsApi, discussionsMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
	ArrowLeft,
	CheckCircle,
	Link2,
	MessageCircle,
	MoreHorizontal,
	Send,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function DiscussionDetailPage() {
	const params = useParams<{
		organizationSlug: string;
		channelSlug: string;
		discussionId: string;
	}>();
	const queryClient = useQueryClient();
	const [messageContent, setMessageContent] = useState("");

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

	const createMessageMutation = useMutation({
		...discussionsMutations.createMessage(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.discussions.listMessages.key(),
			});
			queryClient.invalidateQueries({
				queryKey: orpc.discussions.getDiscussion.key(),
			});
			setMessageContent("");
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

	const handleSendMessage = () => {
		if (!messageContent.trim()) return;
		createMessageMutation.mutate({
			discussionId: params.discussionId,
			content: messageContent.trim(),
		});
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	const backHref = `/app/${params.organizationSlug}/discussions/${params.channelSlug}`;

	if (discussionLoading) {
		return (
			<div className="flex flex-1 flex-col">
				<div className="flex h-14 items-center gap-3 border-b px-6">
					<Skeleton className="h-5 w-64" />
				</div>
				<div className="flex-1 p-6">
					<Skeleton className="h-32 w-full" />
				</div>
			</div>
		);
	}

	if (!discussion) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<div className="text-neutral-500">Discussion not found</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col">
			<div className="flex h-14 shrink-0 items-center justify-between border-b px-6">
				<div className="flex items-center gap-3">
					<Link
						href={backHref}
						className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
					>
						<ArrowLeft className="size-5" />
					</Link>
					<h1 className="truncate font-semibold text-neutral-900">
						{discussion.title}
					</h1>
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
						<Link2 className="size-4" />
					</Button>
					<Button variant="ghost" size="icon" className="size-8">
						<MoreHorizontal className="size-4" />
					</Button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				<div className="border-b p-6">
					<div className="flex items-start gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-medium text-neutral-600">
							{discussion.author?.name?.charAt(0) ?? "?"}
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<span className="font-medium text-neutral-900">
									{discussion.author?.name ?? "Unknown"}
								</span>
								<span className="text-sm text-neutral-500">
									{formatDistanceToNow(
										new Date(discussion.createdAt),
										{
											addSuffix: true,
										},
									)}
								</span>
							</div>
							{discussion.content && (
								<div className="mt-2 whitespace-pre-wrap text-neutral-700">
									{discussion.content}
								</div>
							)}
							{discussion.links &&
								discussion.links.length > 0 && (
									<div className="mt-3 flex flex-wrap gap-2">
										{discussion.links.map((link) => {
											const config =
												ENTITY_TYPE_CONFIG[
													link.entityType as DiscussionLinkEntityType
												];
											if (!config) return null;
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
													<span className="capitalize">
														{link.entityType.replace(
															"_",
															" ",
														)}
													</span>
												</Badge>
											);
										})}
									</div>
								)}
						</div>
					</div>
				</div>

				{discussion.status === "resolved" && discussion.resolution && (
					<div className="border-b bg-green-50 p-6">
						<div className="flex items-start gap-3">
							<CheckCircle className="size-5 shrink-0 text-green-600" />
							<div>
								<div className="font-medium text-green-900">
									Resolution
								</div>
								<div className="mt-1 whitespace-pre-wrap text-green-800">
									{discussion.resolution}
								</div>
							</div>
						</div>
					</div>
				)}

				{messagesLoading ? (
					<div className="space-y-4 p-6">
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-20 w-full" />
					</div>
				) : messages.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
						<MessageCircle className="size-8 text-neutral-300" />
						<p className="text-sm text-neutral-500">
							No replies yet
						</p>
					</div>
				) : (
					<div className="divide-y">
						{messages.map((message) => (
							<div key={message.id} className="p-6">
								<div className="flex items-start gap-3">
									<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-medium text-neutral-600">
										{message.author?.name?.charAt(0) ?? "?"}
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="font-medium text-neutral-900">
												{message.author?.name ??
													"Unknown"}
											</span>
											<span className="text-sm text-neutral-500">
												{formatDistanceToNow(
													new Date(message.createdAt),
													{ addSuffix: true },
												)}
											</span>
										</div>
										<div className="mt-1 whitespace-pre-wrap text-neutral-700">
											{message.content}
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			<div className="shrink-0 border-t bg-white p-4">
				<div className="flex gap-2">
					<Textarea
						placeholder="Write a reply..."
						value={messageContent}
						onChange={(e) => setMessageContent(e.target.value)}
						onKeyDown={handleKeyDown}
						rows={2}
						className="resize-none"
					/>
					<Button
						onClick={handleSendMessage}
						disabled={
							!messageContent.trim() ||
							createMessageMutation.isPending
						}
						className="shrink-0"
					>
						<Send className="size-4" />
					</Button>
				</div>
				<p className="mt-1 text-xs text-neutral-500">
					Press {navigator.platform?.includes("Mac") ? "Cmd" : "Ctrl"}
					+Enter to send
				</p>
			</div>
		</div>
	);
}
