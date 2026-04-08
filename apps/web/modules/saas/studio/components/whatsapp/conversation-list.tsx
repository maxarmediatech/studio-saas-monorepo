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
import { InboxIcon } from "lucide-react";
import type { z } from "zod";

type ConversationItem = z.infer<typeof conversationItemSchema>;

function getConversationName(conversation: ConversationItem) {
	return (
		conversation.contact.name ||
		conversation.contact.pushName ||
		conversation.contact.phoneNumber
	);
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
			<div className="space-y-3 p-4">
				{Array.from({ length: 6 }).map((_, index) => (
					<div
						key={`conversation-skeleton-${index + 1}`}
						className="rounded-2xl border border-border/60 p-4"
					>
						<div className="flex items-center gap-3">
							<Skeleton className="size-11 rounded-full" />
							<div className="min-w-0 flex-1 space-y-2">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-4 w-full" />
							</div>
						</div>
					</div>
				))}
			</div>
		);
	}

	if (conversations.length === 0) {
		return (
			<Empty className="m-4 min-h-[320px] border border-dashed border-border/80 bg-background">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<InboxIcon />
					</EmptyMedia>
					<EmptyTitle>No conversations yet</EmptyTitle>
					<EmptyDescription>
						Incoming WhatsApp chats will appear here once a studio
						number starts receiving messages.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<ScrollArea className="h-full">
			<div className="space-y-2 p-3">
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
								"w-full rounded-2xl border p-3 text-left transition-colors",
								isActive
									? "border-blue-200 bg-blue-50/80"
									: "border-border/60 bg-card hover:bg-muted/40",
							)}
						>
							<div className="flex items-start gap-3">
								<Avatar className="size-11 border border-border/70">
									<AvatarFallback className="bg-neutral-100 text-xs font-semibold text-neutral-700">
										{getConversationInitials(conversation)}
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0 flex-1">
									<div className="flex items-center justify-between gap-2">
										<p className="truncate text-sm font-semibold text-foreground">
											{getConversationName(conversation)}
										</p>
										{formatConversationTime(
											conversation.lastMessageAt,
										) ? (
											<span className="text-xs text-muted-foreground">
												{formatConversationTime(
													conversation.lastMessageAt,
												)}
											</span>
										) : null}
									</div>
									<p className="mt-1 truncate text-sm text-muted-foreground">
										{conversation.lastMessagePreview ||
											"Conversation ready"}
									</p>
									<div className="mt-2 flex items-center gap-2">
										<Badge
											variant={
												conversation.unreadCount > 0
													? "default"
													: "outline"
											}
										>
											{conversation.unreadCount > 0
												? `${conversation.unreadCount} unread`
												: "Read"}
										</Badge>
										<Badge variant="outline">
											{conversation.status}
										</Badge>
										{assigneeLabel ? (
											<Badge variant="outline">
												{assigneeLabel}
											</Badge>
										) : null}
									</div>
								</div>
							</div>
						</button>
					);
				})}
			</div>
		</ScrollArea>
	);
}
