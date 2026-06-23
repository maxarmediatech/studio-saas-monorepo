import { IconFile, IconPhoto, IconX } from "@tabler/icons-react";
import { iconProps } from "../../app/icons";
import type { ComposerAttachment } from "./composerTypes";

export function ComposerAttachmentStrip(props: {
	attachments: ComposerAttachment[];
	onRemove: (id: string) => void;
}) {
	if (props.attachments.length === 0) {
		return null;
	}

	return (
		<div className="flex gap-2 overflow-x-auto px-[18px] pt-3">
			{props.attachments.map((attachment) => {
				const AttachmentIcon =
					attachment.kind === "image" ? IconPhoto : IconFile;
				return (
					<div
						className="flex h-12 min-w-[190px] max-w-[260px] items-center gap-2 rounded-[10px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_52%,transparent)] px-2.5 text-left"
						key={attachment.id}
					>
						<span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-[var(--desktop-inbox)] text-[var(--desktop-subtle)]">
							<AttachmentIcon {...iconProps} size={17} />
						</span>
						<span className="min-w-0 flex-1">
							<span className="block truncate text-[12px] font-semibold text-[var(--desktop-strong)]">
								{attachment.name}
							</span>
							<span className="block truncate text-[11px] text-[var(--desktop-subtle)]">
								{attachment.kind}
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
	);
}
