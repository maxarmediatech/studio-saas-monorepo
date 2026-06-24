import {
	IconArrowDown,
	IconArrowUp,
	IconPlayerPause,
	IconPlayerPlay,
	IconTrash,
} from "@tabler/icons-react";
import { iconProps } from "../../app/icons";
import { IconButton } from "./ComposerControls";
import type { ComposerQueuedRequest } from "./core/composerQueueStore";

export function ComposerQueuePanel(props: {
	items: ComposerQueuedRequest[];
	isPaused: boolean;
	lastError?: string;
	onPause: () => void;
	onResume: () => void;
	onRemove: (queueItemId: string) => void;
	onMove: (queueItemId: string, direction: -1 | 1) => void;
}) {
	if (props.items.length === 0 && !props.lastError) {
		return null;
	}
	return (
		<div className="mb-2 rounded-[14px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox)_82%,transparent)] px-3 py-2">
			<div className="mb-2 flex items-center justify-between gap-3">
				<div className="min-w-0">
					<div className="text-[12px] font-semibold text-[var(--desktop-strong)]">
						Queue
					</div>
					<div className="text-[11px] text-[var(--desktop-muted)]">
						{props.items.length} waiting
						{props.isPaused ? " · paused" : ""}
					</div>
				</div>
				<IconButton
					label={props.isPaused ? "Resume queue" : "Pause queue"}
					onClick={async () =>
						props.isPaused ? props.onResume() : props.onPause()
					}
				>
					{props.isPaused ? (
						<IconPlayerPlay {...iconProps} />
					) : (
						<IconPlayerPause {...iconProps} />
					)}
				</IconButton>
			</div>
			{props.lastError ? (
				<div className="mb-2 rounded-[10px] border border-[color-mix(in_srgb,#ff453a_28%,var(--desktop-inbox-border))] px-2.5 py-2 text-[12px] text-[color-mix(in_srgb,#ff453a_86%,var(--desktop-strong))]">
					{props.lastError}
				</div>
			) : null}
			<div className="flex flex-col gap-1.5">
				{props.items.map((item, index) => (
					<div
						key={item.queueItemId}
						className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[10px] bg-[color-mix(in_srgb,var(--desktop-strong)_4%,transparent)] px-2.5 py-2"
					>
						<div className="min-w-0">
							<div className="truncate text-[12px] text-[var(--desktop-strong)]">
								{item.request.providerInput.prompt}
							</div>
							<div className="mt-0.5 text-[11px] capitalize text-[var(--desktop-muted)]">
								{item.status}
								{item.error ? ` · ${item.error}` : ""}
							</div>
						</div>
						<div className="flex items-center gap-1">
							<IconButton
								label="Move up"
								disabled={index === 0 || item.status === "running"}
								onClick={async () =>
									props.onMove(item.queueItemId, -1)
								}
							>
								<IconArrowUp {...iconProps} />
							</IconButton>
							<IconButton
								label="Move down"
								disabled={
									index === props.items.length - 1 ||
									item.status === "running"
								}
								onClick={async () =>
									props.onMove(item.queueItemId, 1)
								}
							>
								<IconArrowDown {...iconProps} />
							</IconButton>
							<IconButton
								label="Remove queued request"
								disabled={item.status === "running"}
								onClick={async () =>
									props.onRemove(item.queueItemId)
								}
							>
								<IconTrash {...iconProps} />
							</IconButton>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
