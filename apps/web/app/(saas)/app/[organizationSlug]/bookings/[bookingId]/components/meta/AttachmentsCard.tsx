"use client";

import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import {
	ExternalLinkIcon,
	FileIcon,
	FileTextIcon,
	ImageIcon,
	PaperclipIcon,
} from "lucide-react";

type Attachment = {
	name: string;
	size: number;
	type: string;
	url: string;
};

type AttachmentsCardProps = {
	contractAttachment?: Attachment | null;
};

function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string) {
	if (mimeType.startsWith("image/")) return ImageIcon;
	if (mimeType === "application/pdf") return FileTextIcon;
	return FileIcon;
}

function AttachmentRow({ attachment, label }: { attachment: Attachment; label: string }) {
	const Icon = getFileIcon(attachment.type);

	return (
		<div className="flex items-center justify-between rounded-lg border bg-muted/10 px-3 py-2">
			<div className="flex items-center gap-3 min-w-0">
				<div className="rounded-md border bg-background p-2 shrink-0">
					<Icon className="h-4 w-4 text-muted-foreground" />
				</div>
				<div className="min-w-0">
					<p className="text-sm font-medium truncate">{label}</p>
					<p className="text-xs text-muted-foreground">
						{formatFileSize(attachment.size)}
					</p>
				</div>
			</div>
			<Button
				size="icon"
				variant="ghost"
				className="shrink-0"
				asChild
			>
				<a href={attachment.url} target="_blank" rel="noopener noreferrer">
					<ExternalLinkIcon className="h-4 w-4" />
					<span className="sr-only">Open {label}</span>
				</a>
			</Button>
		</div>
	);
}

function EmptyState() {
	return (
		<div className="flex flex-col items-center gap-2 py-6 text-center">
			<PaperclipIcon className="h-6 w-6 text-muted-foreground/30" />
			<p className="text-xs text-muted-foreground">No attachments</p>
		</div>
	);
}

export function AttachmentsCard({ contractAttachment }: AttachmentsCardProps) {
	const hasAttachments = !!contractAttachment;

	return (
		<Card className="shadow-none rounded-lg">
			<CardHeader>
				<CardTitle className="text-base">Attachments</CardTitle>
				<CardDescription>Uploaded files and documents.</CardDescription>
			</CardHeader>
			<CardContent>
				{hasAttachments ? (
					<div className="space-y-2">
						{contractAttachment && (
							<AttachmentRow
								attachment={contractAttachment}
								label="Signed contract"
							/>
						)}
					</div>
				) : (
					<EmptyState />
				)}
			</CardContent>
		</Card>
	);
}
