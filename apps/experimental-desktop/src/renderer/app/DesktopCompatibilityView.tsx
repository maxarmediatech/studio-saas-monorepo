import { IconSparkles } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppInfo, CodexRuntimeMode } from "../../preload/types";
import type { ComposerPayload } from "../components/composer/composerPayload";
import type { ComposerMode } from "../components/composer/composerTriggers";
import type {
	ComposerAttachment,
	ComposerContextItem,
} from "../components/composer/composerTypes";
import { useComposerDraftSync } from "../components/composer/core/composerDraftSync";
import { createComposerDraft } from "../components/composer/core/composerDraftTypes";
import { admitComposerRequest } from "../components/composer/core/composerSendController";
import { SessionComposer } from "../components/composer/SessionComposer";
import { Sidebar } from "../components/layout";
import { RightPanel } from "../components/right-panel";
import { SessionPanel } from "../components/session";
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
		| { kind: "conversation"; conversationId: string }
		| { kind: "capture" };
}) {
	const navigate = useNavigate();
	const [appInfo, setAppInfo] = useState<AppInfo>();
	const [runtimeMode, setRuntimeMode] =
		useState<CodexRuntimeMode>("read-only");
	const [model, setModel] = useState("gpt-5.4-mini");
	const [message, setMessage] = useState("");
	const [composerMode, setComposerMode] = useState<ComposerMode>("ask");
	const [composerContextItems, setComposerContextItems] = useState<
		ComposerContextItem[]
	>([]);
	const [composerAttachments, setComposerAttachments] = useState<
		ComposerAttachment[]
	>([]);
	const [composerResetSignal, setComposerResetSignal] = useState(0);
	const [localDraftScopeId, setLocalDraftScopeId] = useState<string>(() =>
		crypto.randomUUID(),
	);
	const openedConversationRouteRef = useRef<string | undefined>(undefined);
	const openedDraftRouteRef = useRef<string | undefined>(undefined);
	const { theme, toggleTheme } = useThemeMode();
	const workspace = useWorkspaceSelection();
	const provider = useProviderStatus();
	const session = useCodexSession({
		model,
		runtimeMode,
		selectedFolderPath: workspace.selectedFolderPath,
	});

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

	const composerDraft = useMemo(() => {
		return createComposerDraft({
			text: message,
			mode: composerMode,
			model,
			runtimeMode,
			contextItems: composerContextItems,
			attachments: composerAttachments,
		});
	}, [
		message,
		composerMode,
		model,
		runtimeMode,
		composerContextItems,
		composerAttachments,
	]);

	useComposerDraftSync({
		draft: composerDraft,
		draftId: session.draftId,
		conversationId: session.conversationId,
		draftScopeId: session.draftId ?? localDraftScopeId,
		scopeKey: workspace.selectedFolderPath,
		persistDraft: session.persistDraft,
	});

	useEffect(() => {
		if (props.route.kind !== "conversation") {
			return;
		}
		if (
			openedConversationRouteRef.current === props.route.conversationId ||
			session.conversationId === props.route.conversationId
		) {
			return;
		}
		openedConversationRouteRef.current = props.route.conversationId;
		void openConversation(props.route.conversationId);
	}, [props.route, session.conversationId]);

	useEffect(() => {
		if (props.route.kind !== "draft") {
			return;
		}
		if (openedDraftRouteRef.current === props.route.draftId) {
			return;
		}
		openedDraftRouteRef.current = props.route.draftId;
		void createNewSession({ draftScopeId: props.route.draftId });
	}, [props.route]);

	const runtimeOptions: RuntimeOption[] = [
		{ value: "read-only", label: "Read Only" },
		{ value: "workspace-write", label: "Workspace Edit" },
		...(appInfo?.allowFullAccessMode
			? [{ value: "full-access" as const, label: "Full Access" }]
			: []),
	];

	async function sendMessage(payload: ComposerPayload) {
		const admission = admitComposerRequest({
			payload,
			model,
			runtimeMode,
		});
		if (!admission.ok) {
			session.reportComposerAdmissionBlock(admission.reason);
			return false;
		}
		const sent = await session.sendAdmittedRequest(admission.request);
		if (sent) {
			setMessage("");
			setComposerContextItems([]);
			setComposerAttachments([]);
		}
		return sent;
	}

	async function createNewSession(input?: { draftScopeId?: string }) {
		setMessage("");
		setComposerMode("ask");
		setComposerContextItems([]);
		setComposerAttachments([]);
		setLocalDraftScopeId(input?.draftScopeId ?? crypto.randomUUID());
		setComposerResetSignal((signal) => signal + 1);
		await session.createNewSession();
	}

	async function startNewDraftRoute() {
		await navigate({
			to: "/draft/$draftId",
			params: { draftId: crypto.randomUUID() },
		});
	}

	async function openConversation(id: string) {
		const opened = await session.openConversation(id);
		if (opened) {
			setMessage("");
			setComposerMode("ask");
			setComposerContextItems([]);
			setComposerAttachments([]);
			setComposerResetSignal((signal) => signal + 1);
		}
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
						<SessionComposer
							value={message}
							disabled={session.isTurnRunning}
							turnActive={session.isTurnActive}
							mode={composerMode}
							model={model}
							runtimeMode={runtimeMode}
							runtimeOptions={runtimeOptions}
							pendingRequests={session.pendingRequests}
							workspaceRoot={workspace.selectedFolderPath}
							resetSignal={composerResetSignal}
							initialContextItems={composerContextItems}
							initialAttachments={composerAttachments}
							onChange={setMessage}
							onModeChange={setComposerMode}
							onContextItemsChange={setComposerContextItems}
							onAttachmentsChange={setComposerAttachments}
							onModelChange={setModel}
							onRuntimeModeChange={setRuntimeMode}
							onSend={sendMessage}
							onInterrupt={session.interruptConversation}
							onNewSession={startNewDraftRoute}
							onRespondRequest={session.respondToRequest}
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
