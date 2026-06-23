import type { ComposerMode } from "./composerTriggers";

export function ComposerFooter(props: { mode: ComposerMode }) {
	return (
		<div className="relative z-1 mt-[-12px] flex min-h-[48px] items-center justify-between gap-3 rounded-b-[18px] border border-t-0 border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_62%,var(--desktop-inbox))] px-4 pb-0 pt-3 text-[12px] text-[var(--desktop-subtle)] [box-shadow:0_1px_0_color-mix(in_srgb,var(--desktop-strong)_3%,transparent)]">
			<span className="truncate">
				{props.mode === "shell"
					? "Shell mode sends a command request to Codex."
					: "Triggers: / commands, @ files, $ skills, > terminal context"}
			</span>
			<span className="shrink-0">Cmd Enter</span>
		</div>
	);
}
