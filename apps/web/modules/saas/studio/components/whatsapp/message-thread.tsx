"use client";

import type {
	conversationItemSchema,
	messageItemSchema,
} from "@repo/api/modules/whatsapp/types";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
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
	NotebookTextIcon,
	PaperclipIcon,
	RotateCcwIcon,
	SendHorizonalIcon,
} from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";
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

function getConversationMeta(conversation: ConversationItem) {
	if (conversation.contact.name || conversation.contact.pushName) {
		return conversation.contact.phoneNumber;
	}

	return conversation.contact.waId !== conversation.contact.phoneNumber
		? conversation.contact.waId
		: "WhatsApp conversation";
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
			<div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
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
				className="block overflow-hidden rounded-lg border bg-background"
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
	isSending,
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
	isSending: boolean;
	isTemplateActionDisabled: boolean;
	retryingMessageId: string | null;
}) {
	const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);

	if (!conversation) {
		return (
			<Empty className="min-h-[520px] border-0 bg-background">
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
		<div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-background">
			<header className="flex min-h-14 items-center justify-between gap-3 border-b px-4">
				<div className="flex min-w-0 items-center gap-3">
					<MessageCircleMoreIcon className="size-5 shrink-0 text-muted-foreground" />
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h2 className="m-0 truncate text-sm font-medium sm:text-base">
								{getConversationName(conversation)}
							</h2>
							{conversation.unreadCount > 0 ? (
								<Badge className="h-5 px-1.5 text-[10px]">
									{conversation.unreadCount} unread
								</Badge>
							) : null}
						</div>
						<p className="truncate text-xs text-muted-foreground">
							{getConversationMeta(conversation)}
						</p>
					</div>
				</div>
			</header>

			<ScrollArea className="min-h-0 flex-1 bg-neutral-50/60">
				<article className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-3 px-5 py-5 lg:px-8">
					{isLoading ? (
						Array.from({ length: 6 }).map((_, index) => (
							<div
								key={`message-skeleton-${index + 1}`}
								className={cn(
									"max-w-[72%] rounded-lg border px-4 py-3",
									index % 2 === 0
										? "mr-auto bg-muted/30"
										: "ml-auto bg-background",
								)}
							>
								<div className="space-y-2">
									<div className="h-4 w-40 animate-pulse rounded bg-neutral-200" />
									<div className="h-4 w-28 animate-pulse rounded bg-neutral-200" />
								</div>
							</div>
						))
					) : orderedMessages.length === 0 ? (
						<Empty className="min-h-[320px] border border-dashed bg-background">
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
										"w-fit max-w-[min(620px,78%)] rounded-lg border px-4 py-3 shadow-xs",
										isOutbound
											? "ml-auto bg-emerald-50 text-foreground"
											: "mr-auto bg-background text-foreground",
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
											<Badge
												variant="outline"
												className="h-5 px-1.5 text-[10px]"
											>
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
				</article>
			</ScrollArea>

			<div className="shrink-0 border-t bg-background px-5 py-4 lg:px-8">
				<div className="mx-auto w-full max-w-5xl rounded-lg border bg-background">
					<Textarea
						value={composerValue}
						onChange={(event) =>
							onComposerChange(event.target.value)
						}
						placeholder="Message..."
						className="min-h-[76px] resize-none border-0 bg-transparent focus-visible:ring-0"
					/>
					<div className="flex items-center justify-between gap-3 border-t px-3 py-2">
						<div className="flex items-center gap-1">
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-8"
								onClick={onOpenMediaDialog}
								disabled={isTemplateActionDisabled}
							>
								<PaperclipIcon className="size-4" />
								<span className="sr-only">Media</span>
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="size-8"
								onClick={onOpenTemplateDialog}
								disabled={isTemplateActionDisabled}
							>
								<NotebookTextIcon className="size-4" />
								<span className="sr-only">Template</span>
							</Button>
							<span className="ml-1 text-xs text-muted-foreground">
								Use / for snippets
							</span>
						</div>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								size="sm"
								className="gap-1.5"
								onClick={onSendMessage}
								disabled={
									isSending ||
									composerValue.trim().length === 0
								}
							>
								<SendHorizonalIcon className="size-3.5" />
								{isSending ? "Sending..." : "Send"}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
