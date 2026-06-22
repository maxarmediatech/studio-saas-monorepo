import {
	type Icon,
	IconArrowUp,
	IconFolder,
	IconMicrophone,
	IconMoon,
	IconPlus,
	IconSparkles,
	IconSun,
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
					<RuntimeModeSelect
						value={props.runtimeMode}
						options={props.runtimeOptions}
						onChange={props.onRuntimeModeChange}
					/>
				</div>
				<div className="composer-actions">
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
