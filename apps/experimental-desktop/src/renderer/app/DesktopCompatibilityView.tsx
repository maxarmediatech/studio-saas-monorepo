import { IconSparkles } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
	AppInfo,
	CodexRuntimeMode,
	ConversationDetail,
} from "../../preload/types";
import { ComposerRegion } from "../components/composer/ComposerRegion";
import { Sidebar } from "../components/layout";
import { RightPanel } from "../components/right-panel";
import { SessionPanel } from "../components/session";
import type { ConversationResourceState } from "../conversations/conversationResourceStore";
import { useCodexSession } from "../hooks/useCodexSession";
import { useProviderStatus } from "../hooks/useProviderStatus";
import { useThemeMode } from "../hooks/useThemeMode";
import { useWorkspaceSelection } from "../hooks/useWorkspaceSelection";
import { DesktopLayout } from "./DesktopLayout";
import { iconProps } from "./icons";
import type { RuntimeOption } from "./types";

const sessionStageInnerClass =
	"flex h-full w-full flex-col gap-6 px-7 pb-7 pt-[clamp(34px,7vh,72px)] max-[1200px]:px-5";
const modelStorageKey = "experimental-desktop:model";

export function DesktopCompatibilityView(props: {
	route:
		| { kind: "draft"; draftId: string }
		| {
				kind: "conversation";
				conversationId: string;
				resource: ConversationResourceState;
		  }
		| { kind: "capture" };
}) {
	const navigate = useNavigate();
	const [appInfo, setAppInfo] = useState<AppInfo>();
	const [runtimeMode, setRuntimeMode] =
		useState<CodexRuntimeMode>("read-only");
	const [model, setModel] = useState("gpt-5.4-mini");
	const [composerResetKey, setComposerResetKey] = useState<string>();
	const openedConversationRouteRef = useRef<string | undefined>(undefined);
	const { theme, toggleTheme } = useThemeMode();
	const workspace = useWorkspaceSelection();
	const provider = useProviderStatus();
	const session = useCodexSession({
		model,
		runtimeMode,
		selectedFolderPath: workspace.selectedFolderPath,
	});
	const sessionActionsRef = useRef({
		openLoadedConversation: session.openLoadedConversation,
		reportComposerAdmissionBlock: session.reportComposerAdmissionBlock,
	});
	const routeKind = props.route.kind;
	const routeConversationId =
		props.route.kind === "conversation"
			? props.route.conversationId
			: undefined;
	const routeResource =
		props.route.kind === "conversation" ? props.route.resource : undefined;
	const routeDraftId =
		props.route.kind === "draft" ? props.route.draftId : undefined;

	useEffect(() => {
		sessionActionsRef.current = {
			openLoadedConversation: session.openLoadedConversation,
			reportComposerAdmissionBlock: session.reportComposerAdmissionBlock,
		};
	}, [session.openLoadedConversation, session.reportComposerAdmissionBlock]);

	useEffect(() => {
		void window.experimentalDesktop.getAppInfo().then(setAppInfo);
		const savedModel = window.localStorage.getItem(modelStorageKey);
		if (savedModel) {
			setModel(savedModel);
		}
	}, []);

	useEffect(() => {
		window.localStorage.setItem(modelStorageKey, model);
	}, [model]);

	useEffect(() => {
		if (
			routeKind !== "conversation" ||
			!routeConversationId ||
			!routeResource
		) {
			return;
		}
		if (routeResource.status === "loading") {
			return;
		}
		if (routeResource.status === "missing") {
			sessionActionsRef.current.reportComposerAdmissionBlock(
				"Conversation not found",
			);
			return;
		}
		if (routeResource.status === "error") {
			sessionActionsRef.current.reportComposerAdmissionBlock(
				routeResource.error,
			);
			return;
		}
		if (
			openedConversationRouteRef.current === routeConversationId ||
			session.conversationId === routeConversationId
		) {
			return;
		}
		openedConversationRouteRef.current = routeConversationId;
		void openLoadedConversationRoute(routeResource.conversation);
	}, [routeKind, routeConversationId, routeResource, session.conversationId]);

	useEffect(() => {
		if (routeKind !== "draft" || !session.conversationId) {
			return;
		}
		void navigate({
			to: "/conversation/$conversationId",
			params: { conversationId: session.conversationId },
			replace: true,
		});
	}, [routeKind, session.conversationId, navigate]);

	const runtimeOptions: RuntimeOption[] = [
		{ value: "read-only", label: "Read Only" },
		{ value: "workspace-write", label: "Workspace Edit" },
		...(appInfo?.allowFullAccessMode
			? [{ value: "full-access" as const, label: "Full Access" }]
			: []),
	];

	async function openLoadedConversationRoute(
		conversation: ConversationDetail,
	) {
		const opened =
			await sessionActionsRef.current.openLoadedConversation(
				conversation,
			);
		if (opened) {
			setComposerResetKey(`conversation:${conversation.id}`);
		}
	}

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
					conversations={session.conversations}
					activeConversationId={session.conversationId}
					onRuntimeModeChange={setRuntimeMode}
					onNewSession={startNewDraftRoute}
					onOpenConversation={openConversationRoute}
				/>
			}
			inspector={
				<RightPanel
					appInfo={appInfo}
					selectionMessage={workspace.selectionMessage}
					provider={provider}
					pendingRequests={session.pendingRequests}
					eventLog={session.eventLog}
				/>
			}
		>
			<section className="min-h-0 min-w-0 overflow-hidden">
				<div className={sessionStageInnerClass}>
					<div className="flex flex-col items-center gap-3.5">
						<IconSparkles {...iconProps} size={24} />
						<h1 className="m-0 text-[18px] font-medium tracking-normal text-[var(--desktop-strong)]">
							Where should we begin?
						</h1>
					</div>
					<div className="flex w-[min(100%,1080px)] flex-col gap-0 self-center">
						<ComposerRegion
							session={session}
							model={model}
							runtimeMode={runtimeMode}
							runtimeOptions={runtimeOptions}
							workspaceRoot={workspace.selectedFolderPath}
							draftScopeId={
								routeDraftId ??
								session.draftId ??
								`${routeKind}:composer`
							}
							routeDraftId={routeDraftId}
							resetKey={composerResetKey}
							onModelChange={setModel}
							onRuntimeModeChange={setRuntimeMode}
							onNewDraftRoute={startNewDraftRoute}
						/>
					</div>
					<SessionPanel
						status={session.status}
						threadId={session.threadId ?? session.conversationId}
						transcript={session.transcript}
						eventLog={session.eventLog}
						pendingRequests={session.pendingRequests}
						onRespond={session.respondToRequest}
					/>
				</div>
			</section>
		</DesktopLayout>
	);
}
