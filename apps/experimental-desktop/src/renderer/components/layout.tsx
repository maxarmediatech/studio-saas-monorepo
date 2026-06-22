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
import { Button } from "./ui/button";

const navItems = [
	{ icon: IconPlus, label: "New session", action: "new-session" },
	{ icon: IconFolder, label: "Workspace", action: "workspace" },
];

export function TopBar(props: { theme: string; onToggleTheme: () => void }) {
	return (
		<header className="topbar">
			<nav className="mode-tabs" aria-label="Primary">
				<button
					className="brand-mark"
					type="button"
					aria-label="Experimental Desktop"
				>
					<IconSparkles {...iconProps} size={26} />
				</button>
				<TopTab active icon={IconSparkles} label="Chat" />
			</nav>
			<Button
				className="theme-toggle"
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
			className={props.active ? "mode-tab is-active" : "mode-tab"}
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
		<aside className="sidebar">
			<section className="nav-section">
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
								className="nav-item"
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
							className="nav-item is-active"
							type="button"
							key={item.label}
							onClick={() => void props.onNewSession()}
						>
							{content}
						</button>
					);
				})}
			</section>
			<section className="nav-section">
				<p className="section-label">Runtime</p>
				<RuntimeModeSelect
					value={props.runtimeMode}
					options={props.runtimeOptions}
					onChange={props.onRuntimeModeChange}
				/>
				<p className="mode-note">Applies to the next new session.</p>
			</section>
		</aside>
	);
}

export function RuntimeModeSelect(props: {
	value: CodexRuntimeMode;
	options: RuntimeOption[];
	onChange: (mode: CodexRuntimeMode) => void;
}) {
	return (
		<label className="runtime-select">
			<span>Mode</span>
			<select
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
		<section className="composer-shell" aria-label="Codex session composer">
			<div className="composer-card">
				<textarea
					value={props.value}
					className="composer-input"
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
				<div className="composer-toolbar">
					<div className="composer-actions">
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
						/>
					</div>
					<div className="composer-actions">
						<Button
							className="composer-ghost-button"
							size="icon-sm"
							variant="ghost"
							type="button"
						>
							<IconMicrophone {...iconProps} />
						</Button>
						<Button
							className="send-button"
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
];

function ToolConnectStrip() {
	return (
		<div className="tool-connect-strip">
			<div className="tool-connect-copy">
				<IconCirclesRelation {...iconProps} />
				<span>Connect your tools to workspace</span>
			</div>
			<div className="tool-connect-icons">
				{toolIcons.map((tool) => {
					const ToolIcon = tool.icon;
					return (
						<button
							className={`tool-connect-button ${tool.tone}`}
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
];

export function StarterPrompts(props: { onSelect: (prompt: string) => void }) {
	return (
		<section className="starter-card" aria-label="Shortcuts">
			<p className="starter-title">Shortcuts</p>
			<div className="starter-list">
				{starterPrompts.map((prompt) => {
					const PromptIcon = prompt.icon;
					return (
						<button
							className="starter-item"
							type="button"
							key={prompt.label}
							onClick={() => props.onSelect(prompt.label)}
						>
							<PromptIcon
								className={`starter-icon ${prompt.tone}`}
								{...iconProps}
								size={18}
							/>
							<span>{prompt.label}</span>
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
			className="composer-icon-button"
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
