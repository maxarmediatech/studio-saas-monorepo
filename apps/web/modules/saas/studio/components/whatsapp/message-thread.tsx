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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";
import {
	CircleAlertIcon,
	MessageCircleMoreIcon,
	NotebookTextIcon,
	PaperclipIcon,
	RotateCcwIcon,
	SendHorizonalIcon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";
import type { z } from "zod";

type ConversationItem = z.infer<typeof conversationItemSchema>;
type MessageItem = z.infer<typeof messageItemSchema>;
type AssigneeOption = {
	userId: string;
	label: string;
};
const UNASSIGNED_VALUE = "__unassigned__";
const OPEN_VALUE = "open";
const CLOSED_VALUE = "closed";
const ARCHIVED_VALUE = "archived";

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

	if (message.type === "template" && message.templateRenderedText) {
		return message.templateRenderedText;
	}

	if (message.type === "template" && message.templateName) {
		return `Template: ${message.templateName}`;
	}

	if (
		message.media?.fileName &&
		(!message.media.accessUrl ||
			(message.type !== "image" &&
				message.type !== "video" &&
				message.type !== "audio" &&
				message.type !== "sticker"))
	) {
		return message.media.fileName;
	}

	return message.media ? null : `${message.type} message`;
}

function renderMessageMedia(message: MessageItem) {
	if (!message.media) {
		return null;
	}

	if (!message.media.accessUrl) {
		const statusLabel =
			message.media.ingestStatus === "failed"
				? message.media.ingestErrorMessage || "Attachment unavailable"
				: message.direction === "inbound"
					? "Attachment processing..."
					: "Preview unavailable in inbox";

		return (
			<div className="rounded-2xl border border-dashed border-border/70 bg-white/70 px-4 py-3">
				<p className="m-0 text-sm font-medium text-foreground">
					{message.media.fileName || `${message.type} attachment`}
				</p>
				<p className="m-0 mt-1 text-xs text-muted-foreground">
					{statusLabel}
				</p>
			</div>
		);
	}

	if (message.type === "image" || message.type === "sticker") {
		return (
			<a
				href={message.media.accessUrl}
				target="_blank"
				rel="noreferrer"
				className="block overflow-hidden rounded-2xl border border-border/70 bg-white/70"
			>
				<Image
					src={message.media.accessUrl}
					alt={message.media.fileName || `${message.type} attachment`}
					width={1200}
					height={1200}
					sizes="(max-width: 768px) 100vw, 480px"
					className="max-h-80 w-full object-cover"
					unoptimized
				/>
			</a>
		);
	}

	if (message.type === "video") {
		return (
			// biome-ignore lint/a11y/useMediaCaption: WhatsApp inbound video does not include caption tracks.
			<video
				controls
				preload="metadata"
				className="max-h-96 w-full rounded-2xl border border-border/70 bg-black"
			>
				<source
					src={message.media.accessUrl}
					type={message.media.mimeType}
				/>
			</video>
		);
	}

	if (message.type === "audio") {
		return (
			// biome-ignore lint/a11y/useMediaCaption: WhatsApp inbound audio does not include caption tracks.
			<audio controls preload="metadata" className="w-full">
				<source
					src={message.media.accessUrl}
					type={message.media.mimeType}
				/>
			</audio>
		);
	}

	return (
		<a
			href={message.media.accessUrl}
			target="_blank"
			rel="noreferrer"
			className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-white/80 px-4 py-3 no-underline transition hover:border-border hover:bg-white"
		>
			<div className="min-w-0">
				<p className="m-0 truncate text-sm font-medium text-foreground">
					{message.media.fileName || "Open attachment"}
				</p>
				<p className="m-0 truncate text-xs text-muted-foreground">
					{message.media.mimeType}
				</p>
			</div>
			<Badge variant="outline">Open</Badge>
		</a>
	);
}

export function WhatsAppMessageThread({
	conversation,
	messages,
	isLoading,
	composerValue,
	onComposerChange,
	onSendMessage,
	onOpenMediaDialog,
	onOpenTemplateDialog,
	onRetryMessage,
	assigneeOptions,
	onAssignConversation,
	onUpdateConversationStatus,
	isSending,
	isAssigning,
	isUpdatingStatus,
	isTemplateActionDisabled,
	retryingMessageId,
}: {
	conversation: ConversationItem | null;
	messages: MessageItem[];
	isLoading: boolean;
	composerValue: string;
	onComposerChange: (value: string) => void;
	onSendMessage: () => void;
	onOpenMediaDialog: () => void;
	onOpenTemplateDialog: () => void;
	onRetryMessage: (messageId: string) => void;
	assigneeOptions: AssigneeOption[];
	onAssignConversation: (assignedToUserId: string | null) => void;
	onUpdateConversationStatus: (status: ConversationItem["status"]) => void;
	isSending: boolean;
	isAssigning: boolean;
	isUpdatingStatus: boolean;
	isTemplateActionDisabled: boolean;
	retryingMessageId: string | null;
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
							<Select
								value={conversation.status}
								onValueChange={(value) =>
									onUpdateConversationStatus(
										value as ConversationItem["status"],
									)
								}
								disabled={isUpdatingStatus}
							>
								<SelectTrigger className="h-8 min-w-32 text-xs">
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={OPEN_VALUE}>
										Open
									</SelectItem>
									<SelectItem value={CLOSED_VALUE}>
										Closed
									</SelectItem>
									<SelectItem value={ARCHIVED_VALUE}>
										Archived
									</SelectItem>
								</SelectContent>
							</Select>
							<Select
								value={
									conversation.assignedToUserId ??
									UNASSIGNED_VALUE
								}
								onValueChange={(value) =>
									onAssignConversation(
										value === UNASSIGNED_VALUE
											? null
											: value,
									)
								}
								disabled={isAssigning}
							>
								<SelectTrigger className="h-8 min-w-44 text-xs">
									<SelectValue placeholder="Unassigned" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={UNASSIGNED_VALUE}>
										Unassigned
									</SelectItem>
									{assigneeOptions.map((option) => (
										<SelectItem
											key={option.userId}
											value={option.userId}
										>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<p className="mt-1 text-sm text-muted-foreground">
							{conversation.contact.phoneNumber} •{" "}
							{conversation.contact.waId}
							{" • "}
							{formatConversationStatusLabel(conversation.status)}
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
							const body = getMessageBody(message);
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
									<div className="space-y-3">
										{renderMessageMedia(message)}
										{body ? (
											<p className="m-0 whitespace-pre-wrap text-sm leading-6">
												{body}
											</p>
										) : null}
									</div>
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
												<div className="flex flex-wrap items-center justify-between gap-3">
													<p className="m-0">
														{message.errorMessage}
													</p>
													{isOutbound &&
													message.status ===
														"failed" ? (
														<Button
															type="button"
															size="sm"
															variant="outline"
															onClick={() =>
																onRetryMessage(
																	message.id,
																)
															}
															disabled={
																retryingMessageId ===
																message.id
															}
														>
															<RotateCcwIcon className="mr-1.5 size-3.5" />
															{retryingMessageId ===
															message.id
																? "Retrying..."
																: "Retry"}
														</Button>
													) : null}
												</div>
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
							Text, templates, and media all send from this thread
							now.
						</p>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={onOpenMediaDialog}
								disabled={isTemplateActionDisabled}
							>
								<PaperclipIcon className="mr-1.5 size-4" />
								Media
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={onOpenTemplateDialog}
								disabled={isTemplateActionDisabled}
							>
								<NotebookTextIcon className="mr-1.5 size-4" />
								Template
							</Button>
							<Button
								type="button"
								onClick={onSendMessage}
								disabled={
									isSending ||
									composerValue.trim().length === 0
								}
							>
								<SendHorizonalIcon className="mr-1.5 size-4" />
								{isSending ? "Sending..." : "Send"}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
