import { IconSparkles } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { AppInfo, CodexRuntimeMode } from "../../preload/types";
import {
	SessionComposer,
	ShortcutGrid,
	Sidebar,
	TopBar,
	UpgradeRow,
} from "../components/layout";
import { RightPanel } from "../components/right-panel";
import { SessionPanel } from "../components/session";
import { useCodexSession } from "../hooks/useCodexSession";
import { useProviderStatus } from "../hooks/useProviderStatus";
import { useThemeMode } from "../hooks/useThemeMode";
import { useWorkspaceSelection } from "../hooks/useWorkspaceSelection";
import { iconProps } from "./icons";
import type { RuntimeOption } from "./types";

export function App() {
	const [appInfo, setAppInfo] = useState<AppInfo>();
	const [runtimeMode, setRuntimeMode] =
		useState<CodexRuntimeMode>("read-only");
	const [message, setMessage] = useState("");
	const { theme, toggleTheme } = useThemeMode();
	const workspace = useWorkspaceSelection();
	const provider = useProviderStatus();
	const session = useCodexSession({
		runtimeMode,
		selectedFolderPath: workspace.selectedFolderPath,
	});

	useEffect(() => {
		void window.experimentalDesktop.getAppInfo().then(setAppInfo);
	}, []);

	const runtimeOptions: RuntimeOption[] = [
		{ value: "read-only", label: "Read Only" },
		{ value: "workspace-write", label: "Workspace Edit" },
		...(appInfo?.allowFullAccessMode
			? [{ value: "full-access" as const, label: "Full Access" }]
			: []),
	];

	async function sendMessage() {
		const sent = await session.sendMessage(message);
		if (sent) {
			setMessage("");
		}
	}

	return (
		<div className="desktop-root">
			<TopBar theme={theme} onToggleTheme={toggleTheme} />
			<main className="desktop-shell">
				<Sidebar
					onChooseFolder={workspace.chooseFolder}
					runtimeMode={runtimeMode}
					runtimeOptions={runtimeOptions}
					onRuntimeModeChange={setRuntimeMode}
				/>
				<section className="session-stage">
					<div className="session-stage-inner">
						<div className="stage-heading">
							<IconSparkles {...iconProps} size={24} />
							<h1>Where should we begin?</h1>
						</div>
						<SessionComposer
							value={message}
							disabled={session.isSending}
							runtimeMode={runtimeMode}
							runtimeOptions={runtimeOptions}
							onChange={setMessage}
							onRuntimeModeChange={setRuntimeMode}
							onSend={sendMessage}
							onNewSession={session.createNewSession}
							onChooseFile={workspace.chooseFile}
						/>
						<UpgradeRow />
						<ShortcutGrid />
						<SessionPanel
							status={session.status}
							threadId={session.threadId ?? session.sessionId}
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
