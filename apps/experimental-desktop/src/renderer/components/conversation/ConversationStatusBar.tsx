export function ConversationStatusBar(props: {
	status: string;
	threadId?: string;
	rowCount: number;
	pendingCount: number;
}) {
	return (
		<footer className="flex min-h-8 items-center justify-between gap-3 border-t border-border px-4 py-1.5 text-[11px] text-[var(--desktop-subtle)]">
			<div className="flex min-w-0 items-center gap-2">
				<span className="font-medium text-[var(--desktop-strong)]">
					{props.status}
				</span>
				<span>{props.rowCount} rows</span>
				{props.pendingCount > 0 ? (
					<span>{props.pendingCount} pending</span>
				) : null}
			</div>
			<p className="m-0 max-w-[42%] truncate font-mono">
				{props.threadId ?? "No session"}
			</p>
		</footer>
	);
}
