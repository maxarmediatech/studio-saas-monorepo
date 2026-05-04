"use client";

import type { conversationItemSchema } from "@repo/api/modules/whatsapp/types";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import {
	getUploadAccept,
	getUploadHelperText,
	getUploadResponseErrorMessage,
	validateUploadFile,
} from "@shared/lib/upload-policy";
import { CircleAlertIcon, PaperclipIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import {
	getWhatsAppComposerMediaType,
	supportsWhatsAppComposerCaption,
	WHATSAPP_MEDIA_UPLOAD_CONTEXT,
	type WhatsAppComposerMediaType,
} from "./media-compose";

type ConversationItem = z.infer<typeof conversationItemSchema>;

type UploadedMediaPayload = {
	mediaType: WhatsAppComposerMediaType;
	mediaKey: string;
	mimeType: string;
	fileName: string;
	caption?: string;
};

function formatFileSize(bytes: number) {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function WhatsAppMediaComposeDialog({
	open,
	onOpenChange,
	conversation,
	isSending,
	onSendMedia,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	conversation: ConversationItem | null;
	isSending: boolean;
	onSendMedia: (payload: UploadedMediaPayload) => Promise<void>;
}) {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [caption, setCaption] = useState("");
	const [isUploading, setIsUploading] = useState(false);

	useEffect(() => {
		if (open) {
			return;
		}

		setSelectedFile(null);
		setCaption("");
		setIsUploading(false);
	}, [open]);

	const mediaType = useMemo(
		() =>
			selectedFile ? getWhatsAppComposerMediaType(selectedFile) : null,
		[selectedFile],
	);
	const canUseCaption = mediaType
		? supportsWhatsAppComposerCaption(mediaType)
		: false;

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0] ?? null;
		event.target.value = "";

		if (!file) {
			return;
		}

		const validationError = validateUploadFile(
			file,
			WHATSAPP_MEDIA_UPLOAD_CONTEXT,
		);
		if (validationError) {
			toast.error(validationError);
			return;
		}

		const nextMediaType = getWhatsAppComposerMediaType(file);
		if (!nextMediaType) {
			toast.error("Unsupported WhatsApp media type");
			return;
		}

		setSelectedFile(file);
		if (!supportsWhatsAppComposerCaption(nextMediaType)) {
			setCaption("");
		}
	};

	const handleSend = async () => {
		if (!conversation || !selectedFile || !mediaType) {
			return;
		}

		setIsUploading(true);
		try {
			const presignedUrlRes = await fetch("/api/uploads/presigned-url", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					fileName: selectedFile.name,
					fileType: selectedFile.type,
					fileSize: selectedFile.size,
					context: WHATSAPP_MEDIA_UPLOAD_CONTEXT,
				}),
			});

			if (!presignedUrlRes.ok) {
				throw new Error(
					await getUploadResponseErrorMessage(
						presignedUrlRes,
						"Failed to get upload URL",
					),
				);
			}

			const { url, key } = (await presignedUrlRes.json()) as {
				url: string;
				key: string;
			};

			const uploadRes = await fetch(url, {
				method: "PUT",
				body: selectedFile,
				headers: { "Content-Type": selectedFile.type },
			});

			if (!uploadRes.ok) {
				throw new Error("Failed to upload media");
			}

			await onSendMedia({
				mediaType,
				mediaKey: key,
				mimeType: selectedFile.type,
				fileName: selectedFile.name,
				caption:
					canUseCaption && caption.trim().length > 0
						? caption.trim()
						: undefined,
			});

			onOpenChange(false);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to send media",
			);
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Send media</DialogTitle>
					<DialogDescription>
						Upload a file from this studio workspace and send it to
						the active WhatsApp thread.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="rounded-2xl border border-dashed border-border/70 bg-neutral-50/70 p-4">
						<div className="flex items-start gap-3">
							<div className="rounded-xl bg-white p-2 shadow-xs">
								<PaperclipIcon className="size-4 text-muted-foreground" />
							</div>
							<div className="min-w-0 flex-1 space-y-3">
								<div>
									<p className="m-0 text-sm font-medium text-foreground">
										Select file
									</p>
									<p className="m-0 mt-1 text-xs text-muted-foreground">
										{getUploadHelperText(
											WHATSAPP_MEDIA_UPLOAD_CONTEXT,
										)}
									</p>
								</div>
								<Input
									type="file"
									accept={getUploadAccept(
										WHATSAPP_MEDIA_UPLOAD_CONTEXT,
									)}
									onChange={handleFileChange}
									disabled={isUploading || isSending}
								/>
							</div>
						</div>
					</div>

					{selectedFile ? (
						<div className="rounded-2xl border border-border/70 bg-white p-4">
							<p className="m-0 text-sm font-medium text-foreground">
								{selectedFile.name}
							</p>
							<p className="m-0 mt-1 text-xs text-muted-foreground">
								{mediaType ?? "Unknown"} •{" "}
								{formatFileSize(selectedFile.size)}
							</p>
						</div>
					) : null}

					{canUseCaption ? (
						<div className="space-y-2">
							<label
								htmlFor="whatsapp-media-caption"
								className="text-sm font-medium text-foreground"
							>
								Caption
							</label>
							<Textarea
								id="whatsapp-media-caption"
								value={caption}
								onChange={(event) =>
									setCaption(event.target.value)
								}
								placeholder="Add context for the client..."
								className="min-h-24 resize-none"
								disabled={isUploading || isSending}
							/>
						</div>
					) : null}

					{!conversation ? (
						<Alert variant="destructive">
							<CircleAlertIcon />
							<AlertTitle>No conversation selected</AlertTitle>
							<AlertDescription>
								Choose a thread before sending media.
							</AlertDescription>
						</Alert>
					) : null}
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isUploading || isSending}
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={handleSend}
						disabled={
							!conversation ||
							!selectedFile ||
							!mediaType ||
							isUploading ||
							isSending
						}
					>
						{isUploading
							? "Uploading..."
							: isSending
								? "Queueing..."
								: "Send media"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
