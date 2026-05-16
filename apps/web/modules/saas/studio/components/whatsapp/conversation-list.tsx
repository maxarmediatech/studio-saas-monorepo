"use client";

import type { conversationItemSchema } from "@repo/api/modules/whatsapp/types";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@repo/ui/components/empty";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { CheckCircle2Icon, InboxIcon } from "lucide-react";
import type { z } from "zod";

type ConversationItem = z.infer<typeof conversationItemSchema>;

function formatConversationStatusLabel(value: ConversationItem["status"]) {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function getConversationName(conversation: ConversationItem) {
	return (
		conversation.contact.name ||
		conversation.contact.pushName ||
		conversation.contact.phoneNumber
	);
}

function shouldShowSecondaryPhone(conversation: ConversationItem) {
	return Boolean(conversation.contact.name || conversation.contact.pushName);
}

function getConversationInitials(conversation: ConversationItem) {
	return getConversationName(conversation)
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

function formatConversationTime(value: Date | null) {
	if (!value) {
		return null;
	}

	const date = new Date(value);
	const now = new Date();
	const isSameDay = date.toDateString() === now.toDateString();

	return new Intl.DateTimeFormat(undefined, {
		month: isSameDay ? undefined : "short",
		day: isSameDay ? undefined : "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}

export function WhatsAppConversationList({
	conversations,
	isLoading,
	selectedConversationId,
	onSelectConversation,
	resolveAssigneeLabel,
}: {
	conversations: ConversationItem[];
	isLoading: boolean;
	selectedConversationId: string | null;
	onSelectConversation: (conversationId: string) => void;
	resolveAssigneeLabel: (assignedToUserId: string | null) => string | null;
}) {
	if (isLoading) {
		return (
			<div className="p-4">
				{Array.from({ length: 6 }).map((_, index) => (
					<div
						key={`conversation-skeleton-${index + 1}`}
						className="flex gap-3 border-b px-0 py-4 last:border-b-0"
					>
						<div className="flex items-center gap-3">
							<Skeleton className="size-9 rounded-full" />
							<div className="min-w-0 flex-1 space-y-2">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-3 w-44" />
							</div>
						</div>
					</div>
				))}
			</div>
		);
	}

	if (conversations.length === 0) {
		return (
			<Empty className="m-4 min-h-[320px] border border-dashed bg-background">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<InboxIcon />
					</EmptyMedia>
					<EmptyTitle>No conversations yet</EmptyTitle>
					<EmptyDescription>
						Start a message from the header or wait for inbound
						replies.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<ScrollArea className="h-full [&>[data-slot=scroll-area-viewport]>div]:!block">
			<div>
				{conversations.map((conversation) => {
					const isActive = selectedConversationId === conversation.id;
					const assigneeLabel = resolveAssigneeLabel(
						conversation.assignedToUserId,
					);
					return (
						<button
							key={conversation.id}
							type="button"
							onClick={() =>
								onSelectConversation(conversation.id)
							}
							className={cn(
								"flex w-full gap-3 border-b border-l-2 border-l-transparent p-4 text-left text-sm leading-tight transition-colors last:border-b-0",
								conversation.unreadCount > 0 && "bg-muted/30",
								isActive
									? "border-l-emerald-500 bg-white text-foreground"
									: "hover:border-l-neutral-300 hover:bg-neutral-50",
							)}
						>
							<Avatar className="mt-0.5 size-9 shrink-0">
								<AvatarFallback
									className={cn(
										"text-xs font-medium",
										isActive
											? "bg-emerald-600 text-white"
											: "bg-neutral-900 text-white",
									)}
								>
									{getConversationInitials(conversation)}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<div className="flex items-center justify-between gap-2">
									<div className="flex min-w-0 items-center gap-1.5">
										<span
											className={cn(
												"truncate text-sm",
												conversation.unreadCount > 0 &&
													"font-semibold",
											)}
										>
											{getConversationName(conversation)}
										</span>
										{conversation.status === "closed" ? (
											<CheckCircle2Icon className="size-3.5 shrink-0 text-emerald-600" />
										) : null}
									</div>
									{formatConversationTime(
										conversation.lastMessageAt,
									) ? (
										<span className="shrink-0 text-xs text-muted-foreground">
											{formatConversationTime(
												conversation.lastMessageAt,
											)}
										</span>
									) : null}
								</div>
								{shouldShowSecondaryPhone(conversation) ? (
									<p
										className={cn(
											"mt-0.5 truncate text-xs text-muted-foreground",
											conversation.unreadCount > 0 &&
												"font-medium text-foreground",
										)}
									>
										{conversation.contact.phoneNumber}
									</p>
								) : null}
								<p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
									{conversation.lastMessagePreview ||
										"Conversation ready"}
								</p>
								<div className="mt-2 flex min-w-0 items-center gap-1.5">
									{conversation.unreadCount > 0 ? (
										<Badge
											variant="secondary"
											className="h-5 px-1.5 text-[10px]"
										>
											{conversation.unreadCount}
										</Badge>
									) : null}
									{conversation.status !== "open" ? (
										<Badge
											variant="outline"
											className="h-5 px-1.5 text-[10px]"
										>
											{formatConversationStatusLabel(
												conversation.status,
											)}
										</Badge>
									) : null}
									{assigneeLabel ? (
										<Badge
											variant="outline"
											className="h-5 max-w-24 truncate px-1.5 text-[10px]"
										>
											{assigneeLabel}
										</Badge>
									) : null}
								</div>
							</div>
						</button>
					);
				})}
			</div>
		</ScrollArea>
	);
}
