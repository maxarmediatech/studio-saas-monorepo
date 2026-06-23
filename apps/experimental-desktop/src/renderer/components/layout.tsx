import {
	type Icon,
	IconChartBar,
	IconFileText,
	IconFolder,
	IconMoon,
	IconPlus,
	IconRosette,
	IconSparkles,
	IconSun,
	IconTemplate,
} from "@tabler/icons-react";
import type {
	CodexRuntimeMode,
	ConversationSummary,
} from "../../preload/types";
import { iconProps } from "../app/icons";
import type { RuntimeOption } from "../app/types";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";

const navItems = [
	{ icon: IconPlus, label: "New conversation", action: "new-session" },
	{ icon: IconFolder, label: "Workspace", action: "workspace" },
];
const noDragClass = "[-webkit-app-region:no-drag]";
const labelClass = "m-0 text-[12px] font-medium text-[var(--desktop-subtle)]";
const topControlClass =
	"inline-flex h-7 items-center rounded-[7px] text-[var(--desktop-subtle)] no-underline";
const navItemClass =
	"flex min-h-[34px] w-full items-center gap-3 rounded-[7px] border-0 bg-transparent px-3 text-left text-[var(--desktop-default)] no-underline hover:bg-[var(--desktop-selected)]";
const starterToneClass = {
	blue: "text-[#6d70ff]",
	cyan: "text-[#18aee8]",
	green: "text-[#1fc76a]",
	pink: "text-[#ff3d73]",
};

export function TopBar(props: { theme: string; onToggleTheme: () => void }) {
	return (
		<header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-[color-mix(in_srgb,var(--desktop-bg)_90%,transparent)] px-3.5 [-webkit-app-region:drag]">
			<nav
				className={cn("flex min-w-0 items-center gap-2", noDragClass)}
				aria-label="Primary"
			>
				<button
					className={cn(
						topControlClass,
						"w-8 justify-center text-[var(--desktop-strong)]",
						noDragClass,
					)}
					type="button"
					aria-label="Experimental Desktop"
				>
					<IconSparkles {...iconProps} size={26} />
				</button>
				<TopTab active icon={IconSparkles} label="Chat" />
			</nav>
			<Button
				className={cn(
					noDragClass,
					"border-border bg-[var(--desktop-soft)] text-[var(--desktop-subtle)]",
				)}
				size="sm"
				variant="outline"
				type="button"
				onClick={props.onToggleTheme}
			>
				{props.theme === "dark" ? (
					<IconMoon data-icon="inline-start" {...iconProps} />
				) : (
					<IconSun data-icon="inline-start" {...iconProps} />
				)}
				{props.theme === "dark" ? "Light" : "Dark"}
			</Button>
		</header>
	);
}

function TopTab(props: { active?: boolean; icon: Icon; label: string }) {
	const TabIcon = props.icon;
	return (
		<button
			className={cn(
				topControlClass,
				noDragClass,
				"gap-2 px-[9px] text-[13px] font-medium hover:bg-[var(--desktop-selected)] hover:text-[var(--desktop-default)]",
				props.active &&
					"bg-[var(--desktop-selected)] text-[var(--desktop-default)]",
			)}
			type="button"
			aria-current={props.active ? "page" : undefined}
		>
			<TabIcon {...iconProps} />
			<span>{props.label}</span>
		</button>
	);
}

export function Sidebar(props: {
	runtimeMode: CodexRuntimeMode;
	runtimeOptions: RuntimeOption[];
	conversations: ConversationSummary[];
	activeConversationId?: string;
	onRuntimeModeChange: (mode: CodexRuntimeMode) => void;
	onNewSession: () => Promise<void>;
	onOpenConversation: (id: string) => Promise<void>;
	onChooseFolder: () => Promise<void>;
}) {
	return (
		<aside className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-5 border-r border-border bg-[var(--desktop-panel)] px-2.5 py-[18px]">
			<section className="flex flex-col gap-[3px]">
				{navItems.map((item) => {
					const NavIcon = item.icon;
					const content = (
						<>
							<NavIcon {...iconProps} />
							<span>{item.label}</span>
						</>
					);
					if (item.action === "workspace") {
						return (
							<button
								className={navItemClass}
								type="button"
								key={item.label}
								onClick={() => void props.onChooseFolder()}
							>
								{content}
							</button>
						);
					}
					return (
						<button
							className={cn(
								navItemClass,
								"bg-[var(--desktop-selected)]",
							)}
							type="button"
							key={item.label}
							onClick={() => void props.onNewSession()}
						>
							{content}
						</button>
					);
				})}
			</section>
			<section className="flex flex-col gap-[3px]">
				<p className={labelClass}>Runtime</p>
				<RuntimeModeSelect
					value={props.runtimeMode}
					options={props.runtimeOptions}
					onChange={props.onRuntimeModeChange}
				/>
				<p className="mx-2.5 mb-0 mt-1.5 text-[12px] leading-[1.4] text-[var(--desktop-subtle)]">
					Applies to the next new session.
				</p>
			</section>
			<section className="min-h-0 overflow-hidden">
				<p className={labelClass}>History</p>
				<div className="mt-2 flex max-h-full flex-col gap-1 overflow-y-auto pr-1">
					{props.conversations.length === 0 ? (
						<p className="mx-2.5 my-1 text-[12px] leading-[1.4] text-[var(--desktop-subtle)]">
							No saved conversations yet.
						</p>
					) : (
						props.conversations.map((conversation) => (
							<button
								className={cn(
									"min-h-[42px] rounded-[7px] border-0 bg-transparent px-2.5 py-2 text-left hover:bg-[var(--desktop-selected)]",
									props.activeConversationId ===
										conversation.id &&
										"bg-[var(--desktop-selected)]",
								)}
								type="button"
								key={conversation.id}
								onClick={() =>
									void props.onOpenConversation(
										conversation.id,
									)
								}
							>
								<span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-[var(--desktop-default)]">
									{conversation.title}
								</span>
								<span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[var(--desktop-subtle)]">
									{conversation.status}
								</span>
							</button>
						))
					)}
				</div>
			</section>
		</aside>
	);
}

export function RuntimeModeSelect(props: {
	value: CodexRuntimeMode;
	options: RuntimeOption[];
	onChange: (mode: CodexRuntimeMode) => void;
	variant?: "default" | "composer";
}) {
	const isComposer = props.variant === "composer";
	return (
		<div
			className={cn(
				"inline-flex h-8 items-center gap-2 rounded-[9px] border-0 bg-transparent px-1 text-[13px] text-[var(--desktop-subtle)]",
				isComposer && "h-9 gap-0 p-0",
			)}
		>
			<span className={isComposer ? "hidden" : undefined}>Mode</span>
			<Select
				items={props.options}
				value={props.value}
				onValueChange={(value) =>
					props.onChange(value as CodexRuntimeMode)
				}
			>
				<SelectTrigger
					aria-label="Runtime mode"
					size={isComposer ? "default" : "sm"}
					className={cn(
						"border-0 bg-transparent p-0 text-[13px] font-medium text-[var(--desktop-default)] shadow-none hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent",
						isComposer &&
							"h-9 min-w-[184px] rounded-[10px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_46%,transparent)] px-3 text-[14px] dark:bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_46%,transparent)]",
					)}
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
		</div>
	);
}

const starterPrompts = [
	{
		icon: IconChartBar,
		label: "Summarize the latest session events",
		tone: "blue",
	},
	{
		icon: IconRosette,
		label: "Check runtime and provider status",
		tone: "green",
	},
	{
		icon: IconTemplate,
		label: "Plan the next desktop UI pass",
		tone: "pink",
	},
	{
		icon: IconFileText,
		label: "Review pending approvals and risks",
		tone: "cyan",
	},
] as const;

export function StarterPrompts(props: { onSelect: (prompt: string) => void }) {
	return (
		<section
			className="flex flex-col gap-2.5 rounded-[15px] border border-[var(--desktop-inbox-border)] bg-[var(--desktop-inbox)] px-5 pb-5 pt-[18px] [box-shadow:0_1px_0_color-mix(in_srgb,var(--desktop-strong)_3%,transparent),0_12px_24px_-28px_var(--desktop-shadow)]"
			aria-label="Shortcuts"
		>
			<p className="m-0 text-[16px] font-normal text-[var(--desktop-subtle)]">
				Shortcuts
			</p>
			<div className="flex flex-col gap-0.5">
				{starterPrompts.map((prompt) => {
					const PromptIcon = prompt.icon;
					return (
						<button
							className="grid min-h-10 grid-cols-[24px_minmax(0,1fr)] items-center gap-2.5 rounded-[10px] border-0 bg-transparent px-3 text-left text-[var(--desktop-default)] hover:bg-[var(--desktop-inbox-hover)] focus-visible:bg-[var(--desktop-inbox-hover)] focus-visible:outline-0"
							type="button"
							key={prompt.label}
							onClick={() => props.onSelect(prompt.label)}
						>
							<PromptIcon
								className={starterToneClass[prompt.tone]}
								{...iconProps}
								size={18}
							/>
							<span className="overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-normal">
								{prompt.label}
							</span>
						</button>
					);
				})}
			</div>
		</section>
	);
}
