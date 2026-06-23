import { IconFilePlus, IconX } from "@tabler/icons-react";
import { iconProps } from "../../app/icons";
import { cn } from "../../lib/utils";
import type { ComposerPayloadMetrics } from "./composerPayload";
import type { ComposerContextItem } from "./composerTypes";

const chipClass =
	"inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-[8px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_72%,transparent)] px-2.5 text-[12px] font-medium text-[var(--desktop-subtle)]";

export function ComposerContextChips(props: {
	contextItems: ComposerContextItem[];
	textTokens: string[];
	metrics: ComposerPayloadMetrics;
	onRemoveContext: (path: string) => void;
}) {
	if (props.contextItems.length === 0 && props.textTokens.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-wrap gap-1.5 px-[18px] pt-3">
			{props.contextItems.map((item) => (
				<span className={cn(chipClass, "pr-1")} key={item.path}>
					<IconFilePlus {...iconProps} size={14} />
					<span className="truncate">{item.label}</span>
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
				<span
					className={cn(
						chipClass,
						props.metrics.approxTokens > 4000 &&
							"border-[color-mix(in_srgb,#ff7a45_42%,var(--desktop-inbox-border))] text-[color-mix(in_srgb,#ff7a45_82%,var(--desktop-default))]",
					)}
				>
					<span className="truncate">
						{props.metrics.itemCount} ctx · ~
						{props.metrics.approxTokens.toLocaleString()} tok
					</span>
				</span>
			) : null}
		</div>
	);
}
