"use client";

import type { EditorContentJson } from "@repo/editor";
import { LiteRichTextEditor, ReadOnlyRenderer } from "@repo/editor";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
} from "@repo/ui/components/input-group";
import { cn } from "@repo/ui/lib/utils";
import { useSession } from "@saas/auth/hooks/use-session";
import { UserAvatar } from "@shared/components/UserAvatar";
import { formatDistanceToNow } from "date-fns";
import { Send } from "lucide-react";
import { useState } from "react";

const EMPTY_DOC: EditorContentJson = {
	type: "doc",
	content: [{ type: "paragraph" }],
};

function isEditorContentJson(value: unknown): value is EditorContentJson {
	if (typeof value !== "object" || value === null) return false;
	const record = value as Record<string, unknown>;
	return record.type === "doc";
}

export interface ThreadMessage {
	id: string;
	content: string;
	contentJson?: unknown | null;
	contentText?: string | null;
	createdAt: Date | string;
	author?: {
		id: string;
		name: string | null;
		image: string | null;
	} | null;
}

export interface ThreadRootMessage extends ThreadMessage {
	replyCount: number;
	replies?: ThreadMessage[];
}

export interface ThreadCardProps {
	message: ThreadRootMessage;
	onReplySubmit: (parentId: string, contentJson: EditorContentJson) => void;
	onViewMoreReplies?: (threadRootId: string) => void;
	isSubmitting: boolean;
}

export function ThreadCard({
	message,
	onReplySubmit,
	onViewMoreReplies,
	isSubmitting,
}: ThreadCardProps) {
	const { user } = useSession();
	const [replyDoc, setReplyDoc] = useState<EditorContentJson>(EMPTY_DOC);
	const [replyText, setReplyText] = useState("");
	const [showReplyInput, setShowReplyInput] = useState(false);

	const handleSubmitReply = () => {
		if (!replyText.trim()) return;
		onReplySubmit(message.id, replyDoc);
		setReplyDoc(EMPTY_DOC);
		setReplyText("");
		setShowReplyInput(false);
	};

	const allMessages = [message, ...(message.replies ?? [])];
	const remainingReplies =
		message.replyCount - (message.replies?.length ?? 0);

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
										{ addSuffix: true },
									)}
								</span>
							</div>
							{isEditorContentJson(msg.contentJson) ? (
								<ReadOnlyRenderer
									content={msg.contentJson}
									className="mt-1 text-sm text-foreground"
								/>
							) : (
								<p className="mt-1 text-sm text-foreground">
									{msg.contentText ?? msg.content}
								</p>
							)}
						</div>
					</div>
				</div>
			))}

			{remainingReplies > 0 && (
				<div className="border-t px-4 py-2">
					<button
						type="button"
						onClick={() => onViewMoreReplies?.(message.id)}
						className="text-xs text-muted-foreground hover:text-foreground"
					>
						View {remainingReplies} more{" "}
						{remainingReplies === 1 ? "reply" : "replies"}
					</button>
				</div>
			)}

			<div className="border-t p-3">
				{showReplyInput ? (
					<InputGroup className="bg-background">
						<LiteRichTextEditor
							value={replyDoc}
							onChange={(payload) => {
								setReplyDoc(payload.json);
								setReplyText(payload.text);
							}}
							onSubmit={handleSubmitReply}
							placeholder="Write a reply..."
							className="min-h-[60px] w-full resize-none bg-transparent px-3 py-2 text-sm outline-none"
							editable={!isSubmitting}
						/>
						<InputGroupAddon align="block-end">
							<InputGroupButton
								className="ml-auto"
								size="sm"
								variant="default"
								onClick={handleSubmitReply}
								disabled={!replyText.trim() || isSubmitting}
							>
								<Send className="size-3" />
								Reply
							</InputGroupButton>
						</InputGroupAddon>
					</InputGroup>
				) : (
					<button
						type="button"
						onClick={() => setShowReplyInput(true)}
						className="w-full flex items-center gap-2 py-2 px-1 -mx-1 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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
