import type { ClipboardEvent, DragEvent, ReactNode } from "react";
import { cn } from "../../lib/utils";
import type { ComposerMode } from "./composerTriggers";

export function ComposerFrame(props: {
	mode: ComposerMode;
	pendingDock: ReactNode;
	menu: ReactNode;
	chips: ReactNode;
	attachments: ReactNode;
	editor: ReactNode;
	toolbar: ReactNode;
	footer: ReactNode;
	dragActive?: boolean;
	onDragEnter?: (event: DragEvent<HTMLElement>) => void;
	onDragOver?: (event: DragEvent<HTMLElement>) => void;
	onDragLeave?: (event: DragEvent<HTMLElement>) => void;
	onDrop?: (event: DragEvent<HTMLElement>) => void;
	onPaste?: (event: ClipboardEvent<HTMLElement>) => void;
}) {
	return (
		<section
			className="isolate flex flex-col overflow-visible border-0 bg-transparent shadow-none"
			aria-label="Codex session composer"
			onDragEnter={props.onDragEnter}
			onDragOver={props.onDragOver}
			onDragLeave={props.onDragLeave}
			onDrop={props.onDrop}
			onPaste={props.onPaste}
		>
			{props.pendingDock}
			<div
				className={cn(
					"relative z-2 flex min-h-[132px] flex-col rounded-[18px] border border-[var(--desktop-inbox-border)] bg-[var(--desktop-inbox)] [box-shadow:0_1px_0_color-mix(in_srgb,var(--desktop-strong)_3%,transparent),0_10px_22px_-18px_var(--desktop-shadow)]",
					props.mode === "shell" &&
						"border-[color-mix(in_srgb,#32d583_34%,var(--desktop-inbox-border))]",
					props.mode === "plan" &&
						"border-[color-mix(in_srgb,#f7c948_34%,var(--desktop-inbox-border))]",
					props.mode === "build" &&
						"border-[color-mix(in_srgb,#0a84ff_34%,var(--desktop-inbox-border))]",
					props.mode === "review" &&
						"border-[color-mix(in_srgb,#ff7a45_30%,var(--desktop-inbox-border))]",
				)}
			>
				{props.dragActive ? (
					<div className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-[14px] border border-dashed border-[color-mix(in_srgb,#0a84ff_48%,var(--desktop-inbox-border))] bg-[color-mix(in_srgb,var(--desktop-inbox)_88%,transparent)] text-[13px] font-semibold text-[var(--desktop-strong)]">
						Drop files to attach
					</div>
				) : null}
				{props.menu}
				{props.chips}
				{props.attachments}
				{props.editor}
				{props.toolbar}
			</div>
			{props.footer}
		</section>
	);
}
