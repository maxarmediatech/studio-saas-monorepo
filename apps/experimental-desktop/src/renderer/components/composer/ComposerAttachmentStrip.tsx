import { IconFile, IconPhoto, IconX } from "@tabler/icons-react";
import { iconProps } from "../../app/icons";
import { cn } from "../../lib/utils";
import type { ComposerAttachment } from "./composerTypes";

export function ComposerAttachmentStrip(props: {
	attachments: ComposerAttachment[];
	notice?: string;
	onRemove: (id: string) => void;
}) {
	if (props.attachments.length === 0) {
		return null;
	}

	return (
		<div className="space-y-2 px-[18px] pt-3">
			<div className="flex gap-2 overflow-x-auto">
				{props.attachments.map((attachment) => {
					const AttachmentIcon =
						attachment.kind === "image" ? IconPhoto : IconFile;
					return (
						<div
							className={cn(
								"flex h-12 min-w-[190px] max-w-[280px] items-center gap-2 rounded-[10px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_52%,transparent)] px-2.5 text-left",
								attachment.status === "failed" &&
									"border-[color-mix(in_srgb,#ff7a45_48%,var(--desktop-inbox-border))]",
							)}
							key={attachment.id}
						>
							{attachment.previewUrl ? (
								<img
									alt=""
									className="size-8 shrink-0 rounded-[8px] object-cover"
									src={attachment.previewUrl}
								/>
							) : (
								<span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-[var(--desktop-inbox)] text-[var(--desktop-subtle)]">
									<AttachmentIcon {...iconProps} size={17} />
								</span>
							)}
							<span className="min-w-0 flex-1">
								<span className="block truncate text-[12px] font-semibold text-[var(--desktop-strong)]">
									{attachment.name}
								</span>
								<span
									className={cn(
										"block truncate text-[11px] text-[var(--desktop-subtle)]",
										attachment.status === "failed" &&
											"text-[color-mix(in_srgb,#ff7a45_84%,var(--desktop-default))]",
									)}
								>
									{attachment.status === "failed"
										? attachment.error
										: attachmentSummary(attachment)}
								</span>
							</span>
							<button
								className="grid size-7 shrink-0 place-items-center rounded-[8px] border-0 bg-transparent text-[var(--desktop-subtle)] hover:bg-[var(--desktop-inbox)] hover:text-[var(--desktop-strong)]"
								type="button"
								aria-label={`Remove ${attachment.name}`}
								onClick={() => props.onRemove(attachment.id)}
							>
								<IconX {...iconProps} size={14} />
							</button>
						</div>
					);
				})}
			</div>
			{props.notice ? (
				<div className="truncate text-[11px] text-[color-mix(in_srgb,#ff7a45_84%,var(--desktop-default))]">
					{props.notice}
				</div>
			) : null}
		</div>
	);
}

function attachmentSummary(attachment: ComposerAttachment) {
	return [
		attachment.mimeType || attachment.kind,
		formatBytes(attachment.size),
	]
		.filter(Boolean)
		.join(" · ");
}

function formatBytes(size: number | undefined) {
	if (!size) {
		return undefined;
	}
	if (size < 1024) {
		return `${size} B`;
	}
	if (size < 1024 * 1024) {
		return `${(size / 1024).toFixed(1)} KB`;
	}
	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
