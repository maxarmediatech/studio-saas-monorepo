import { IconBolt, IconBrain, IconTerminal2 } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { CodexRuntimeMode } from "../../../preload/types";
import { iconProps } from "../../app/icons";
import type { RuntimeOption } from "../../app/types";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import type { ComposerMode } from "./composerTriggers";

const composerControlClass =
	"!size-9 !rounded-[10px] !p-0 [&_svg]:!size-[18px] [&_svg]:!stroke-[1.8]";

export function ModePill(props: {
	mode: ComposerMode;
	onModeChange: (mode: ComposerMode) => void;
}) {
	return (
		<button
			className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_46%,transparent)] px-3 text-[13px] font-medium text-[var(--desktop-default)]"
			type="button"
			onClick={() =>
				props.onModeChange(props.mode === "shell" ? "normal" : "shell")
			}
		>
			{props.mode === "shell" ? (
				<IconTerminal2 {...iconProps} size={16} />
			) : (
				<IconBrain {...iconProps} size={16} />
			)}
			{props.mode === "shell" ? "Shell" : "Ask"}
		</button>
	);
}

export function ModelPill(props: {
	model: string;
	onModelChange: (model: string) => void;
}) {
	return (
		<label className="hidden h-9 items-center gap-1.5 rounded-[10px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_46%,transparent)] px-3 text-[13px] font-medium text-[var(--desktop-default)] min-[1180px]:inline-flex">
			<IconBolt {...iconProps} size={16} />
			<input
				className="w-[112px] border-0 bg-transparent p-0 text-[13px] outline-none"
				value={props.model}
				aria-label="Model"
				onChange={(event) =>
					props.onModelChange(event.currentTarget.value)
				}
			/>
		</label>
	);
}

export function RuntimeModeSelect(props: {
	value: CodexRuntimeMode;
	options: RuntimeOption[];
	onChange: (mode: CodexRuntimeMode) => void;
}) {
	return (
		<Select
			items={props.options}
			value={props.value}
			onValueChange={(value) => props.onChange(value as CodexRuntimeMode)}
		>
			<SelectTrigger
				aria-label="Runtime mode"
				className="h-9 min-w-[158px] rounded-[10px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_46%,transparent)] px-3 text-[13px] font-medium text-[var(--desktop-default)] shadow-none hover:bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_68%,transparent)] dark:bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_46%,transparent)]"
			>
				<SelectValue />
			</SelectTrigger>
			<SelectContent align="start" alignItemWithTrigger={false}>
				<SelectGroup>
					{props.options.map((option) => (
						<SelectItem value={option.value} key={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}

export function IconButton(props: {
	label: string;
	children: ReactNode;
	onClick: () => Promise<void>;
}) {
	return (
		<Button
			className={cn(
				composerControlClass,
				"border-[var(--desktop-inbox-border)] bg-transparent text-[var(--desktop-subtle)] active:scale-[0.98]",
			)}
			size="icon-sm"
			variant="outline"
			type="button"
			title={props.label}
			aria-label={props.label}
			onClick={() => void props.onClick()}
		>
			{props.children}
		</Button>
	);
}

export { composerControlClass };
