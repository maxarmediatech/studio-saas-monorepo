import {
	type Icon,
	IconApps,
	IconArrowUp,
	IconCode,
	IconCrown,
	IconFeather,
	IconFolder,
	IconMessageChatbot,
	IconMicrophone,
	IconMoon,
	IconPlus,
	IconRoute,
	IconSearch,
	IconSend2,
	IconSparkles,
	IconSun,
	IconWorld,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { CodexRuntimeMode } from "../../preload/types";
import { iconProps } from "../app/icons";
import type { RuntimeOption } from "../app/types";
import { Button } from "./ui/button";

const navItems = [
	{ icon: IconPlus, label: "New task", active: true },
	{ icon: IconFolder, label: "Workspace" },
	{ icon: IconRoute, label: "Active runs" },
	{ icon: IconApps, label: "Live Artifacts" },
	{ icon: IconApps, label: "Plugins" },
];

const workspaces = [
	"Growth Operator",
	"Content Pipeline",
	"Workflow Engine",
	"Research Cluster",
];

const recents = [
	"Fix spacing on cards",
	"Need better empty state",
	"Update sidebar structure",
	"Mobile runtime needs cleanup",
	"Improve retrieval accuracy",
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
				<TopTab icon={IconMessageChatbot} label="Agent" />
				<TopTab icon={IconCode} label="Code" />
				<TopTab icon={IconFeather} label="Design" />
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
			<label className="search-field">
				<IconSearch {...iconProps} />
				<input type="search" placeholder="Search" />
				<kbd>Cmd K</kbd>
			</label>
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
					if (item.label === "Workspace") {
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
							className={
								item.active ? "nav-item is-active" : "nav-item"
							}
							type="button"
							key={item.label}
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
			</section>
			<section className="nav-section">
				<p className="section-label">Workspace</p>
				{workspaces.map((workspace) => (
					<button className="nav-item" type="button" key={workspace}>
						<IconFolder {...iconProps} />
						<span>{workspace}</span>
					</button>
				))}
			</section>
			<section className="nav-section recents">
				<p className="section-label">Recents</p>
				{recents.map((recent) => (
					<button type="button" key={recent}>
						{recent}
					</button>
				))}
			</section>
			<section className="connect-strip">
				<p className="connect-title">Connect apps</p>
				<p>External tools such as Figma, GitHub, Drive</p>
				<div className="app-dots" aria-hidden="true">
					<span>G</span>
					<span>S</span>
					<span>D</span>
					<span>F</span>
					<span>+</span>
				</div>
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
	onChooseFile: () => Promise<void>;
}) {
	return (
		<section className="composer-card" aria-label="Codex session composer">
			<textarea
				value={props.value}
				className="composer-input"
				placeholder="Ask anything..."
				disabled={props.disabled}
				onChange={(event) => props.onChange(event.currentTarget.value)}
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
					<IconButton
						label="Choose file"
						onClick={props.onChooseFile}
					>
						<IconSend2 {...iconProps} />
					</IconButton>
					<RuntimeModeSelect
						value={props.runtimeMode}
						options={props.runtimeOptions}
						onChange={props.onRuntimeModeChange}
					/>
				</div>
				<div className="composer-actions">
					<span className="model-pill">
						<span className="model-mark" />
						Opus 4.7
					</span>
					<Button size="icon-sm" variant="ghost" type="button">
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

export function UpgradeRow() {
	return (
		<section className="upgrade-row">
			<div>
				<IconCrown {...iconProps} />
				<strong>Upgrade to PRO</strong>
			</div>
			<Button size="xs" variant="secondary" type="button">
				Upgrade
			</Button>
		</section>
	);
}

export function ShortcutGrid() {
	const shortcuts = [
		{ icon: IconPlus, title: "Create", text: "Tasks, images, docs" },
		{ icon: IconSearch, title: "Find", text: "Answers & files" },
		{ icon: IconWorld, title: "Research", text: "Apps & web" },
	];
	return (
		<section className="quick-grid" aria-label="Shortcuts">
			{shortcuts.map((shortcut) => {
				const ShortcutIcon = shortcut.icon;
				return (
					<article key={shortcut.title}>
						<ShortcutIcon {...iconProps} />
						<strong>{shortcut.title}</strong>
						<span>{shortcut.text}</span>
					</article>
				);
			})}
		</section>
	);
}
