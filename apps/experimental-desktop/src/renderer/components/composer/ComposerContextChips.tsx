import { IconFilePlus, IconX } from "@tabler/icons-react";
import { iconProps } from "../../app/icons";
import { cn } from "../../lib/utils";
import {
	FOLDER_CONTEXT_MODES,
	isFolderContext,
	modeLabel,
} from "./composerFolderContext";
import type { ComposerPayloadMetrics } from "./composerPayload";
import type { ComposerContextItem, ComposerFolderMode } from "./composerTypes";

const chipClass =
	"inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-[8px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_72%,transparent)] px-2.5 text-[12px] font-medium text-[var(--desktop-subtle)]";

export function ComposerContextChips(props: {
	contextItems: ComposerContextItem[];
	textTokens: string[];
	metrics: ComposerPayloadMetrics;
	onRemoveContext: (path: string) => void;
	onChangeFolderMode?: (path: string, mode: ComposerFolderMode) => void;
}) {
	if (props.contextItems.length === 0 && props.textTokens.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-wrap gap-1.5 px-[18px] pt-3">
			{props.contextItems.map((item) => (
				<span
					className={cn(
						chipClass,
						"h-auto min-h-7 max-w-[380px] flex-wrap py-1 pr-1",
					)}
					key={item.path}
					title={item.description}
				>
					<IconFilePlus {...iconProps} size={14} />
					<span className="max-w-[180px] truncate">{item.label}</span>
					{isFolderContext(item) ? (
						<span className="rounded-[7px] bg-[var(--desktop-inbox)] px-1.5 py-0.5 text-[11px]">
							{item.folderStatus === "scanning"
								? "Scanning..."
								: modeLabel(item.folderMode ?? "reference")}
							{item.folderSnapshot
								? ` · ${item.folderSnapshot.includedFileCount}/${item.folderSnapshot.fileCount} files`
								: ""}
						</span>
					) : null}
					{isFolderContext(item) && props.onChangeFolderMode ? (
						<span className="flex items-center gap-0.5">
							{FOLDER_CONTEXT_MODES.map((mode) => (
								<button
									className={cn(
										"rounded-[6px] border border-transparent px-1.5 py-0.5 text-[10px] text-[var(--desktop-muted)] hover:bg-[var(--desktop-inbox)] hover:text-[var(--desktop-strong)]",
										(item.folderMode ?? "reference") ===
											mode.mode &&
											"border-[var(--desktop-inbox-border)] bg-[var(--desktop-inbox)] text-[var(--desktop-strong)]",
									)}
									type="button"
									key={mode.mode}
									title={mode.description}
									onClick={() =>
										props.onChangeFolderMode?.(
											item.path,
											mode.mode,
										)
									}
								>
									{mode.label}
								</button>
							))}
						</span>
					) : null}
					<button
						className="grid size-5 shrink-0 place-items-center rounded-[6px] border-0 bg-transparent text-[var(--desktop-subtle)] hover:bg-[var(--desktop-inbox)] hover:text-[var(--desktop-strong)]"
						type="button"
						aria-label={`Remove ${item.label}`}
						onClick={() => props.onRemoveContext(item.path)}
					>
						<IconX {...iconProps} size={13} />
					</button>
				</span>
			))}
			{props.textTokens.map((token) => (
				<span className={chipClass} key={token}>
					<IconFilePlus {...iconProps} size={14} />
					<span className="truncate">{token}</span>
				</span>
			))}
			{props.metrics.itemCount > 0 ? (
				<span className={chipClass}>
					<span className="truncate">
						{props.metrics.itemCount} refs · ~
						{props.metrics.approxTokens.toLocaleString()} meta tok
					</span>
				</span>
			) : null}
		</div>
	);
}
