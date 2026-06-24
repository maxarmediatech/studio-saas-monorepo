import {
	IconAlertTriangle,
	IconCircleDashed,
	IconInbox,
	IconPlus,
	IconRefresh,
	IconSparkles,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useState } from "react";
import type { AppInfo, CodexRuntimeMode } from "../../preload/types";
import { Sidebar } from "../components/layout";
import { SettingsPanel } from "../components/right-panel";
import { Button } from "../components/ui/button";
import { useConversationHistoryStore } from "../conversations/conversationHistoryStore";
import { useProviderStatus } from "../hooks/useProviderStatus";
import { useThemeMode } from "../hooks/useThemeMode";
import { useWorkspaceSelection } from "../hooks/useWorkspaceSelection";
import { DesktopLayout } from "./DesktopLayout";
import { iconProps } from "./icons";
import type { RuntimeOption } from "./types";

type DesktopRouteState =
	| {
			kind: "conversation-loading";
			conversationId: string;
	  }
	| {
			kind: "conversation-missing";
			conversationId: string;
			onRetry: () => void;
	  }
	| {
			kind: "conversation-error";
			conversationId: string;
			error: string;
			onRetry: () => void;
	  }
	| {
			kind: "capture";
	  };

const runtimeOptionsBase: RuntimeOption[] = [
	{ value: "read-only", label: "Read Only" },
	{ value: "workspace-write", label: "Workspace Edit" },
];

export function DesktopRouteStateView(props: { state: DesktopRouteState }) {
	const navigate = useNavigate();
	const [appInfo, setAppInfo] = useState<AppInfo>();
	const [runtimeMode, setRuntimeMode] =
		useState<CodexRuntimeMode>("read-only");
	const { theme, toggleTheme } = useThemeMode();
	const workspace = useWorkspaceSelection();
	const provider = useProviderStatus();
	const history = useConversationHistoryStore();
	const activeConversationId =
		props.state.kind === "conversation-loading" ||
		props.state.kind === "conversation-missing" ||
		props.state.kind === "conversation-error"
			? props.state.conversationId
			: undefined;

	useEffect(() => {
		void window.experimentalDesktop.getAppInfo().then(setAppInfo);
	}, []);

	const runtimeOptions = [
		...runtimeOptionsBase,
		...(appInfo?.allowFullAccessMode
			? [{ value: "full-access" as const, label: "Full Access" }]
			: []),
	];

	async function startNewDraftRoute() {
		await navigate({
			to: "/draft/$draftId",
			params: { draftId: crypto.randomUUID() },
		});
	}

	async function openConversationRoute(id: string) {
		await navigate({
			to: "/conversation/$conversationId",
			params: { conversationId: id },
		});
	}

	return (
		<DesktopLayout
			theme={theme}
			onToggleTheme={toggleTheme}
			sidebar={
				<Sidebar
					onChooseFolder={workspace.chooseFolder}
					runtimeMode={runtimeMode}
					runtimeOptions={runtimeOptions}
					conversations={history.conversations}
					activeConversationId={activeConversationId}
					onRuntimeModeChange={setRuntimeMode}
					onNewSession={startNewDraftRoute}
					onOpenConversation={openConversationRoute}
				/>
			}
			settings={
				<SettingsPanel
					appInfo={appInfo}
					selectionMessage={workspace.selectionMessage}
					provider={provider}
					pendingRequests={[]}
					eventLog={[]}
				/>
			}
		>
			<section className="min-h-0 min-w-0 overflow-hidden">
				<div className="grid h-full place-items-center px-7 py-8">
					<RouteStatePanel
						state={props.state}
						onNewDraft={startNewDraftRoute}
					/>
				</div>
			</section>
		</DesktopLayout>
	);
}

function RouteStatePanel(props: {
	state: DesktopRouteState;
	onNewDraft: () => Promise<void>;
}) {
	if (props.state.kind === "conversation-loading") {
		return (
			<StateSurface
				icon={<IconCircleDashed {...iconProps} size={22} />}
				label="Conversation"
				title="Opening conversation"
				description="Loading the saved timeline and route resource."
				meta={props.state.conversationId}
			>
				<div className="grid gap-2">
					<SkeletonLine width="76%" />
					<SkeletonLine width="54%" />
					<SkeletonLine width="68%" />
				</div>
			</StateSurface>
		);
	}

	if (props.state.kind === "conversation-missing") {
		return (
			<StateSurface
				icon={<IconInbox {...iconProps} size={22} />}
				label="Conversation"
				title="Conversation not found"
				description="This route points to a conversation that is no longer available locally."
				meta={props.state.conversationId}
			>
				<ActionRow>
					<Button
						type="button"
						onClick={() => void props.onNewDraft()}
					>
						<IconPlus data-icon="inline-start" {...iconProps} />
						New draft
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={props.state.onRetry}
					>
						<IconRefresh data-icon="inline-start" {...iconProps} />
						Retry
					</Button>
				</ActionRow>
			</StateSurface>
		);
	}

	if (props.state.kind === "conversation-error") {
		return (
			<StateSurface
				icon={<IconAlertTriangle {...iconProps} size={22} />}
				label="Conversation"
				title="Conversation failed to load"
				description={props.state.error}
				meta={props.state.conversationId}
			>
				<ActionRow>
					<Button type="button" onClick={props.state.onRetry}>
						<IconRefresh data-icon="inline-start" {...iconProps} />
						Retry
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => void props.onNewDraft()}
					>
						<IconPlus data-icon="inline-start" {...iconProps} />
						New draft
					</Button>
				</ActionRow>
			</StateSurface>
		);
	}

	return (
		<StateSurface
			icon={<IconSparkles {...iconProps} size={22} />}
			label="Capture"
			title="Quick capture"
			description="A dedicated intake surface is now reserved here for notes, tasks, reminders, and studio ops context."
		>
			<div className="grid gap-2 border-t border-border pt-4 text-[12px] text-[var(--desktop-subtle)]">
				<CaptureRow label="Inbox" value="Unfiled notes and ideas" />
				<CaptureRow
					label="Next"
					value="Draft persistence and routing"
				/>
				<CaptureRow label="Status" value="Shell separated from chat" />
			</div>
		</StateSurface>
	);
}

function StateSurface(props: {
	icon: React.ReactNode;
	label: string;
	title: string;
	description: string;
	meta?: string;
	children: React.ReactNode;
}) {
	return (
		<section className="grid w-[min(100%,560px)] gap-5 rounded-[18px] border border-[var(--desktop-inbox-border)] bg-[color-mix(in_srgb,var(--desktop-inbox)_86%,transparent)] p-6 shadow-[0_1px_0_color-mix(in_srgb,var(--desktop-strong)_3%,transparent),0_18px_42px_-38px_var(--desktop-shadow)]">
			<div className="flex items-start gap-3.5">
				<div className="grid size-10 shrink-0 place-items-center rounded-[12px] border border-[var(--desktop-inbox-border)] bg-[var(--desktop-inbox-hover)] text-[var(--desktop-strong)]">
					{props.icon}
				</div>
				<div className="min-w-0">
					<p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--desktop-subtle)]">
						{props.label}
					</p>
					<h1 className="mb-0 mt-1 text-[20px] font-semibold tracking-normal text-[var(--desktop-strong)]">
						{props.title}
					</h1>
					<p className="mb-0 mt-2 max-w-[46ch] text-[13px] leading-[1.55] text-[var(--desktop-subtle)]">
						{props.description}
					</p>
				</div>
			</div>
			{props.meta ? (
				<p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-[9px] border border-border bg-background/40 px-3 py-2 font-mono text-[11px] text-[var(--desktop-subtle)]">
					{props.meta}
				</p>
			) : null}
			{props.children}
		</section>
	);
}

function ActionRow(props: { children: React.ReactNode }) {
	return <div className="flex flex-wrap gap-2">{props.children}</div>;
}

function SkeletonLine(props: { width: string }) {
	return (
		<div
			className="h-3 rounded-full bg-[linear-gradient(90deg,var(--desktop-soft),var(--desktop-selected),var(--desktop-soft))] bg-[length:200%_100%] opacity-80 animate-in fade-in duration-300"
			style={{ width: props.width }}
		/>
	);
}

function CaptureRow(props: { label: string; value: string }) {
	return (
		<div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3">
			<span className="font-medium text-[var(--desktop-default)]">
				{props.label}
			</span>
			<span>{props.value}</span>
		</div>
	);
}
