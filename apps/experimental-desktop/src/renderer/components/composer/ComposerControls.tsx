import {
	IconBolt,
	IconBrain,
	IconCode,
	IconListCheck,
	IconSearch,
	IconTerminal2,
} from "@tabler/icons-react";
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
	const modes: Array<{
		mode: ComposerMode;
		label: string;
		icon: typeof IconBrain;
	}> = [
		{ mode: "ask", label: "Ask", icon: IconBrain },
		{ mode: "plan", label: "Plan", icon: IconListCheck },
		{ mode: "build", label: "Build", icon: IconCode },
		{ mode: "review", label: "Review", icon: IconSearch },
		{ mode: "shell", label: "Shell", icon: IconTerminal2 },
	];

	return (
		<div className="inline-flex h-9 items-center rounded-[10px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_38%,transparent)] p-0.5">
			{modes.map((item) => {
				const ModeIcon = item.icon;
				const active = props.mode === item.mode;
				return (
					<button
						className={cn(
							"inline-flex h-8 items-center gap-1.5 rounded-[8px] border-0 bg-transparent px-2.5 text-[12px] font-semibold text-[var(--desktop-subtle)] transition-colors hover:text-[var(--desktop-default)]",
							active &&
								"bg-[var(--desktop-inbox)] text-[var(--desktop-strong)] shadow-[0_1px_0_color-mix(in_srgb,var(--desktop-strong)_4%,transparent)]",
						)}
						type="button"
						key={item.mode}
						aria-pressed={active}
						onClick={() => props.onModeChange(item.mode)}
					>
						<ModeIcon {...iconProps} size={15} />
						<span className="max-[1280px]:hidden">
							{item.label}
						</span>
					</button>
				);
			})}
		</div>
	);
}

export function ModelPill(props: {
	model: string;
	onModelChange: (model: string) => void;
}) {
	const modelOptions = ["gpt-5.5-thinking", "gpt-5.4", "gpt-5.4-mini"];

	return (
		<Select
			items={modelOptions.map((model) => ({
				value: model,
				label: model,
			}))}
			value={props.model}
			onValueChange={(value) => {
				if (value) {
					props.onModelChange(value);
				}
			}}
		>
			<SelectTrigger
				aria-label="Model"
				className="hidden h-9 min-w-[156px] rounded-[10px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_46%,transparent)] px-3 text-[13px] font-medium text-[var(--desktop-default)] shadow-none hover:bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_68%,transparent)] min-[1180px]:inline-flex dark:bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_46%,transparent)]"
			>
				<IconBolt {...iconProps} size={16} />
				<SelectValue />
			</SelectTrigger>
			<SelectContent align="start" alignItemWithTrigger={false}>
				<SelectGroup>
					{modelOptions.map((model) => (
						<SelectItem value={model} key={model}>
							{model}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
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
