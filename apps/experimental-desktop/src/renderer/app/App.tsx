import { IconSparkles } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { AppInfo, CodexRuntimeMode } from "../../preload/types";
import type { ComposerContextItem } from "../components/composer/composerTypes";
import { SessionComposer } from "../components/composer/SessionComposer";
import { Sidebar, TopBar } from "../components/layout";
import { RightPanel } from "../components/right-panel";
import { SessionPanel } from "../components/session";
import { useCodexSession } from "../hooks/useCodexSession";
import { useProviderStatus } from "../hooks/useProviderStatus";
import { useThemeMode } from "../hooks/useThemeMode";
import { useWorkspaceSelection } from "../hooks/useWorkspaceSelection";
import { iconProps } from "./icons";
import type { RuntimeOption } from "./types";

const desktopRootClass =
	"grid h-dvh w-screen min-w-[980px] grid-rows-[44px_minmax(0,1fr)] bg-[var(--desktop-bg)]";
const desktopShellClass =
	"grid min-h-0 grid-cols-[276px_minmax(520px,1fr)_320px] max-[1200px]:grid-cols-[248px_minmax(500px,1fr)_292px]";
const sessionStageInnerClass =
	"flex h-full w-full flex-col gap-6 px-7 pb-7 pt-[clamp(34px,7vh,72px)] max-[1200px]:px-5";
const modelStorageKey = "experimental-desktop:model";

export function App() {
	const [appInfo, setAppInfo] = useState<AppInfo>();
	const [runtimeMode, setRuntimeMode] =
		useState<CodexRuntimeMode>("read-only");
	const [model, setModel] = useState("gpt-5.4-mini");
	const [message, setMessage] = useState("");
	const [composerContextItems, setComposerContextItems] = useState<
		ComposerContextItem[]
	>([]);
	const [composerResetSignal, setComposerResetSignal] = useState(0);
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

	useEffect(() => {
		const timeout = window.setTimeout(() => {
			if (
				message.trim() ||
				composerContextItems.length > 0 ||
				session.draftId
			) {
				void session.persistDraft(message, composerContextItems);
			}
		}, 350);
		return () => window.clearTimeout(timeout);
	}, [
		message,
		composerContextItems,
		model,
		runtimeMode,
		workspace.selectedFolderPath,
		session.conversationId,
		session.draftId,
	]);

	const runtimeOptions: RuntimeOption[] = [
		{ value: "read-only", label: "Read Only" },
		{ value: "workspace-write", label: "Workspace Edit" },
		...(appInfo?.allowFullAccessMode
			? [{ value: "full-access" as const, label: "Full Access" }]
			: []),
	];

	async function sendMessage(text: string) {
		const sent = await session.sendMessage(text);
		if (sent) {
			setMessage("");
		}
		return sent;
	}

	async function createNewSession() {
		setMessage("");
		setComposerContextItems([]);
		setComposerResetSignal((signal) => signal + 1);
		await session.createNewSession();
	}

	async function openConversation(id: string) {
		const opened = await session.openConversation(id);
		if (opened) {
			setMessage("");
			setComposerContextItems([]);
			setComposerResetSignal((signal) => signal + 1);
		}
	}

	return (
		<div className={desktopRootClass}>
			<TopBar theme={theme} onToggleTheme={toggleTheme} />
			<main className={desktopShellClass}>
				<Sidebar
					onChooseFolder={workspace.chooseFolder}
					runtimeMode={runtimeMode}
					runtimeOptions={runtimeOptions}
					conversations={session.conversations}
					activeConversationId={session.conversationId}
					onRuntimeModeChange={setRuntimeMode}
					onNewSession={createNewSession}
					onOpenConversation={openConversation}
				/>
				<section className="min-h-0 min-w-0 overflow-hidden">
					<div className={sessionStageInnerClass}>
						<div className="flex flex-col items-center gap-3.5">
							<IconSparkles {...iconProps} size={24} />
							<h1 className="m-0 text-[18px] font-medium tracking-normal text-[var(--desktop-strong)]">
								Where should we begin?
							</h1>
						</div>
						<div className="flex w-[min(100%,1080px)] flex-col gap-0 self-center">
							{/* <StarterPrompts onSelect={setMessage} /> */}
							<SessionComposer
								value={message}
								disabled={session.isTurnRunning}
								turnActive={session.isTurnActive}
								model={model}
								runtimeMode={runtimeMode}
								runtimeOptions={runtimeOptions}
								pendingRequests={session.pendingRequests}
								workspaceRoot={workspace.selectedFolderPath}
								resetSignal={composerResetSignal}
								initialContextItems={composerContextItems}
								onChange={setMessage}
								onContextItemsChange={setComposerContextItems}
								onModelChange={setModel}
								onRuntimeModeChange={setRuntimeMode}
								onSend={sendMessage}
								onInterrupt={session.interruptConversation}
								onNewSession={createNewSession}
								onRespondRequest={session.respondToRequest}
							/>
						</div>
						<SessionPanel
							status={session.status}
							threadId={
								session.threadId ?? session.conversationId
							}
							transcript={session.transcript}
							eventLog={session.eventLog}
							pendingRequests={session.pendingRequests}
							onRespond={session.respondToRequest}
						/>
					</div>
				</section>
				<RightPanel
					appInfo={appInfo}
					selectionMessage={workspace.selectionMessage}
					provider={provider}
					pendingRequests={session.pendingRequests}
					eventLog={session.eventLog}
				/>
			</main>
		</div>
	);
}
