import {
	type Icon,
	IconArrowUp,
	IconBrandFigma,
	IconBrandGithub,
	IconBrandGoogleDrive,
	IconBrandNotion,
	IconBrandSlack,
	IconBrandTrello,
	IconChartBar,
	IconCirclesRelation,
	IconFileText,
	IconFolder,
	IconMicrophone,
	IconMoon,
	IconPlus,
	IconRosette,
	IconSparkles,
	IconSun,
	IconTemplate,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { CodexRuntimeMode } from "../../preload/types";
import { iconProps } from "../app/icons";
import type { RuntimeOption } from "../app/types";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

const navItems = [
	{ icon: IconPlus, label: "New session", action: "new-session" },
	{ icon: IconFolder, label: "Workspace", action: "workspace" },
];
const noDragClass = "[-webkit-app-region:no-drag]";
const labelClass = "m-0 text-[12px] font-medium text-[var(--desktop-subtle)]";
const topControlClass =
	"inline-flex h-7 items-center rounded-[7px] text-[var(--desktop-subtle)] no-underline";
const navItemClass =
	"flex min-h-[34px] w-full items-center gap-3 rounded-[7px] border-0 bg-transparent px-3 text-left text-[var(--desktop-default)] no-underline hover:bg-[var(--desktop-selected)]";
const composerControlClass =
	"!size-9 !rounded-[10px] !p-0 [&_svg]:!size-[18px] [&_svg]:!stroke-[1.8]";
const toolToneClass = {
	drive: "text-[#1a73e8]",
	figma: "text-[#f24e1e]",
	github: "text-[var(--desktop-default)]",
	notion: "text-[var(--desktop-default)]",
	slack: "text-[#28a8ea]",
	trello: "text-[#0c66e4]",
};
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
	onRuntimeModeChange: (mode: CodexRuntimeMode) => void;
	onNewSession: () => Promise<void>;
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
		</aside>
	);
}

export function RuntimeModeSelect(props: {
	value: CodexRuntimeMode;
	options: RuntimeOption[];
	onChange: (mode: CodexRuntimeMode) => void;
	variant?: "default" | "composer";
}) {
	return (
		<label
			className={cn(
				"inline-flex h-8 items-center gap-2 rounded-[9px] border-0 bg-transparent px-1 text-[13px] text-[var(--desktop-subtle)]",
				props.variant === "composer" &&
					"h-7 gap-0 rounded-full border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_46%,transparent)] px-2.5",
			)}
		>
			<span
				className={props.variant === "composer" ? "hidden" : undefined}
			>
				Mode
			</span>
			<select
				className={cn(
					"border-0 bg-transparent text-[13px] font-medium text-[var(--desktop-default)] outline-0",
					props.variant === "composer" && "text-[12px]",
				)}
				value={props.value}
				onChange={(event) =>
					props.onChange(
						event.currentTarget.value as CodexRuntimeMode,
					)
				}
			>
				{props.options.map((option) => (
					<option value={option.value} key={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	);
}

export function SessionComposer(props: {
	value: string;
	disabled: boolean;
	runtimeMode: CodexRuntimeMode;
	runtimeOptions: RuntimeOption[];
	onChange: (value: string) => void;
	onRuntimeModeChange: (mode: CodexRuntimeMode) => void;
	onSend: () => Promise<void>;
	onNewSession: () => Promise<void>;
}) {
	return (
		<section
			className="isolate flex flex-col overflow-visible border-0 bg-transparent shadow-none"
			aria-label="Codex session composer"
		>
			<div className="relative z-2 flex min-h-[118px] flex-col rounded-[18px] border border-[var(--desktop-inbox-border)] bg-[var(--desktop-inbox)] [box-shadow:0_1px_0_color-mix(in_srgb,var(--desktop-strong)_3%,transparent),0_10px_22px_-18px_var(--desktop-shadow)]">
				<textarea
					value={props.value}
					className="min-h-[70px] resize-none border-0 bg-transparent px-[18px] pb-1.5 pt-4 text-[14px] font-[440] leading-[1.45] text-[var(--desktop-default)] shadow-none placeholder:text-[color-mix(in_srgb,var(--desktop-subtle)_58%,transparent)] focus-visible:shadow-none"
					placeholder="What do you want to create?"
					disabled={props.disabled}
					onChange={(event) =>
						props.onChange(event.currentTarget.value)
					}
					onKeyDown={(event) => {
						if (
							(event.metaKey || event.ctrlKey) &&
							event.key === "Enter"
						) {
							event.preventDefault();
							void props.onSend();
						}
					}}
				/>
				<div className="flex items-center justify-between gap-2 px-4 pb-3 [&_svg]:!stroke-[1.8]">
					<div className="flex items-center gap-2">
						<IconButton
							label="New session"
							onClick={props.onNewSession}
						>
							<IconPlus {...iconProps} />
						</IconButton>
						<RuntimeModeSelect
							value={props.runtimeMode}
							options={props.runtimeOptions}
							onChange={props.onRuntimeModeChange}
							variant="composer"
						/>
					</div>
					<div className="flex items-center gap-2">
						<Button
							className={cn(
								composerControlClass,
								"text-[var(--desktop-subtle)]",
							)}
							size="icon-sm"
							variant="ghost"
							type="button"
						>
							<IconMicrophone {...iconProps} />
						</Button>
						<Button
							className={cn(
								composerControlClass,
								"!bg-[color-mix(in_srgb,#0a84ff_62%,#ffffff)] text-white shadow-none",
							)}
							size="icon-sm"
							type="button"
							disabled={props.disabled}
							onClick={() => void props.onSend()}
						>
							<IconArrowUp {...iconProps} />
						</Button>
					</div>
				</div>
			</div>
			<ToolConnectStrip />
		</section>
	);
}

const toolIcons = [
	{ icon: IconBrandGithub, label: "GitHub", tone: "github" },
	{ icon: IconBrandSlack, label: "Slack", tone: "slack" },
	{ icon: IconBrandTrello, label: "Trello", tone: "trello" },
	{ icon: IconBrandNotion, label: "Notion", tone: "notion" },
	{ icon: IconBrandFigma, label: "Figma", tone: "figma" },
	{ icon: IconBrandGoogleDrive, label: "Google Drive", tone: "drive" },
] as const;

function ToolConnectStrip() {
	return (
		<div className="relative z-1 mt-[-12px] flex min-h-16 items-center justify-between gap-3 rounded-b-[18px] border border-t-0 border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox-hover)_62%,var(--desktop-inbox))] px-4 pb-2 pt-4 [box-shadow:0_1px_0_color-mix(in_srgb,var(--desktop-strong)_3%,transparent)] [&_svg]:!size-[18px] [&_svg]:!stroke-[1.8]">
			<div className="inline-flex min-w-0 items-center gap-2 text-[13px] font-medium text-[color-mix(in_srgb,var(--desktop-subtle)_88%,var(--desktop-default))]">
				<IconCirclesRelation {...iconProps} />
				<span className="overflow-hidden text-ellipsis whitespace-nowrap">
					Connect your tools to workspace
				</span>
			</div>
			<div className="flex flex-[0_0_auto] items-center gap-1.5">
				{toolIcons.map((tool) => {
					const ToolIcon = tool.icon;
					return (
						<button
							className={cn(
								"grid size-9 place-items-center rounded-[10px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox)_92%,var(--desktop-inbox-hover))] text-[var(--desktop-subtle)] [box-shadow:0_1px_0_color-mix(in_srgb,var(--desktop-strong)_4%,transparent)]",
								toolToneClass[tool.tone],
							)}
							type="button"
							key={tool.label}
							title={tool.label}
							aria-label={tool.label}
						>
							<ToolIcon {...iconProps} />
						</button>
					);
				})}
			</div>
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

function IconButton(props: {
	label: string;
	children: ReactNode;
	onClick: () => Promise<void>;
}) {
	return (
		<Button
			className={cn(
				composerControlClass,
				"border-[var(--desktop-inbox-border)] bg-transparent text-[var(--desktop-subtle)]",
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
