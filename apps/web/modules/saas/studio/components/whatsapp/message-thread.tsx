"use client";

import type {
	conversationItemSchema,
	messageItemSchema,
} from "@repo/api/modules/whatsapp/types";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@repo/ui/components/empty";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";
import {
	CircleAlertIcon,
	MessageCircleMoreIcon,
	SendHorizonalIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { z } from "zod";

type ConversationItem = z.infer<typeof conversationItemSchema>;
type MessageItem = z.infer<typeof messageItemSchema>;

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

function formatMessageTime(value: Date) {
	return new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));
}

function getMessageBody(message: MessageItem) {
	if (message.textBody) {
		return message.textBody;
	}

	if (message.caption) {
		return message.caption;
	}

	if (message.type === "template" && message.templateName) {
		return `Template: ${message.templateName}`;
	}

	if (message.media?.fileName) {
		return message.media.fileName;
	}

	return `${message.type} message`;
}

export function WhatsAppMessageThread({
	conversation,
	messages,
	isLoading,
	composerValue,
	onComposerChange,
	onSendMessage,
	isSending,
}: {
	conversation: ConversationItem | null;
	messages: MessageItem[];
	isLoading: boolean;
	composerValue: string;
	onComposerChange: (value: string) => void;
	onSendMessage: () => void;
	isSending: boolean;
}) {
	const scrollBottomRef = useRef<HTMLDivElement | null>(null);
	const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);

	useEffect(() => {
		scrollBottomRef.current?.scrollIntoView({
			block: "end",
		});
	}, [orderedMessages.length]);

	if (!conversation) {
		return (
			<Empty className="m-6 min-h-[420px] border border-dashed border-border/80 bg-background">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<MessageCircleMoreIcon />
					</EmptyMedia>
					<EmptyTitle>Select a conversation</EmptyTitle>
					<EmptyDescription>
						Choose a thread from the left rail to read and reply.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="grid h-full min-h-[720px] grid-rows-[auto_minmax(0,1fr)_auto]">
			<div className="border-b border-border/70 px-5 py-4">
				<div className="flex items-start gap-3">
					<Avatar className="size-11 border border-border/70">
						<AvatarFallback className="bg-neutral-100 text-xs font-semibold text-neutral-700">
							{getConversationInitials(conversation)}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<h2 className="m-0 truncate text-base font-semibold text-foreground">
								{getConversationName(conversation)}
							</h2>
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
						</div>
						<p className="mt-1 text-sm text-muted-foreground">
							{conversation.contact.phoneNumber} •{" "}
							{conversation.contact.waId}
						</p>
					</div>
				</div>
			</div>

			<ScrollArea className="bg-neutral-50/60">
				<div className="space-y-4 px-5 py-5">
					{isLoading ? (
						Array.from({ length: 6 }).map((_, index) => (
							<div
								key={`message-skeleton-${index + 1}`}
								className={cn(
									"max-w-[85%] rounded-2xl border px-4 py-3",
									index % 2 === 0
										? "mr-auto bg-white"
										: "ml-auto bg-blue-50",
								)}
							>
								<div className="space-y-2">
									<div className="h-4 w-40 animate-pulse rounded bg-neutral-200" />
									<div className="h-4 w-28 animate-pulse rounded bg-neutral-200" />
								</div>
							</div>
						))
					) : orderedMessages.length === 0 ? (
						<Empty className="min-h-[320px] border border-dashed border-border/80 bg-background">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<MessageCircleMoreIcon />
								</EmptyMedia>
								<EmptyTitle>No messages yet</EmptyTitle>
								<EmptyDescription>
									This conversation exists, but the thread is
									still empty.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						orderedMessages.map((message) => {
							const isOutbound = message.direction === "outbound";
							return (
								<div
									key={message.id}
									className={cn(
										"max-w-[85%] rounded-2xl border px-4 py-3 shadow-xs",
										isOutbound
											? "ml-auto border-blue-200 bg-blue-50 text-blue-950"
											: "mr-auto border-border/70 bg-white text-foreground",
									)}
								>
									<p className="m-0 whitespace-pre-wrap text-sm leading-6">
										{getMessageBody(message)}
									</p>
									<div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
										<span>
											{formatMessageTime(
												message.createdAt,
											)}
										</span>
										{isOutbound ? (
											<Badge variant="outline">
												{message.status}
											</Badge>
										) : null}
									</div>
									{message.errorMessage ? (
										<Alert
											variant="destructive"
											className="mt-3 border-destructive/20"
										>
											<CircleAlertIcon />
											<AlertTitle>Send issue</AlertTitle>
											<AlertDescription>
												<p>{message.errorMessage}</p>
											</AlertDescription>
										</Alert>
									) : null}
								</div>
							);
						})
					)}
					<div ref={scrollBottomRef} />
				</div>
			</ScrollArea>

			<div className="border-t border-border/70 bg-white px-5 py-4">
				<div className="space-y-3">
					<Textarea
						value={composerValue}
						onChange={(event) =>
							onComposerChange(event.target.value)
						}
						placeholder={`Reply to ${getConversationName(conversation)}...`}
						className="min-h-24 resize-none"
					/>
					<div className="flex items-center justify-between gap-3">
						<p className="m-0 text-xs text-muted-foreground">
							Text only for this first slice. Media and templates
							come next.
						</p>
						<Button
							type="button"
							onClick={onSendMessage}
							disabled={
								isSending || composerValue.trim().length === 0
							}
						>
							<SendHorizonalIcon className="mr-1.5 size-4" />
							{isSending ? "Sending..." : "Send"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
