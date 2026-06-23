import { forwardRef, type KeyboardEvent } from "react";
import { cn } from "../../lib/utils";
import type { ComposerMode } from "./composerTriggers";

export const ComposerTextarea = forwardRef<
	HTMLTextAreaElement,
	{
		value: string;
		mode: ComposerMode;
		disabled: boolean;
		onChange: (value: string, target: HTMLTextAreaElement) => void;
		onSelectionChange: (target: HTMLTextAreaElement) => void;
		onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
	}
>(function ComposerTextarea(props, ref) {
	return (
		<textarea
			ref={ref}
			value={props.value}
			className={cn(
				"min-h-[76px] resize-none border-0 bg-transparent px-[18px] pb-1.5 pt-4 text-[14px] font-[440] leading-[1.45] text-[var(--desktop-default)] shadow-none outline-none placeholder:text-[color-mix(in_srgb,var(--desktop-subtle)_58%,transparent)] focus-visible:shadow-none",
				props.mode === "shell" &&
					"font-mono text-[13px] text-[color-mix(in_srgb,#32d583_80%,var(--desktop-default))]",
			)}
			placeholder={placeholderForMode(props.mode)}
			disabled={props.disabled}
			onChange={(event) =>
				props.onChange(event.currentTarget.value, event.currentTarget)
			}
			onClick={(event) => props.onSelectionChange(event.currentTarget)}
			onKeyUp={(event) => props.onSelectionChange(event.currentTarget)}
			onSelect={(event) => props.onSelectionChange(event.currentTarget)}
			onKeyDown={props.onKeyDown}
		/>
	);
});

function placeholderForMode(mode: ComposerMode) {
	switch (mode) {
		case "plan":
			return "Describe the change to plan...";
		case "build":
			return "Describe what to build...";
		case "review":
			return "Describe what to review...";
		case "ask":
			return "Ask, plan, edit, attach context...";
		case "shell":
			return "Run command...";
	}
}
