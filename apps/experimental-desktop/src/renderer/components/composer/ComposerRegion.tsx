import { useEffect, useMemo, useRef, useState } from "react";
import type {
	CodexRuntimeMode,
	RespondSessionRequestInput,
} from "../../../preload/types";
import type { PendingRequest, RuntimeOption } from "../../app/types";
import type { ComposerPayload } from "./composerPayload";
import { createComposerDraft } from "./core/composerDraftTypes";
import { useComposerDraftSync } from "./core/composerDraftSync";
import type { AdmittedComposerRequest } from "./core/composerProviderTypes";
import { admitComposerRequest } from "./core/composerSendController";
import { SessionComposer } from "./SessionComposer";
import type { ComposerMode } from "./composerTriggers";
import type { ComposerAttachment, ComposerContextItem } from "./composerTypes";

export type ComposerRegionSession = {
	draftId?: string;
	conversationId?: string;
	isTurnRunning: boolean;
	isTurnActive: boolean;
	pendingRequests: PendingRequest[];
	persistDraft: Parameters<typeof useComposerDraftSync>[0]["persistDraft"];
	sendAdmittedRequest: (
		request: AdmittedComposerRequest,
	) => Promise<boolean>;
	reportComposerAdmissionBlock: (reason: string) => void;
	interruptConversation: () => Promise<void>;
	createNewSession: () => Promise<void>;
	respondToRequest: (
		requestId: string,
		response: RespondSessionRequestInput,
	) => Promise<void>;
};

export function ComposerRegion(props: {
	session: ComposerRegionSession;
	model: string;
	runtimeMode: CodexRuntimeMode;
	runtimeOptions: RuntimeOption[];
	workspaceRoot?: string;
	draftScopeId: string;
	routeDraftId?: string;
	resetKey?: string;
	onModelChange: (model: string) => void;
	onRuntimeModeChange: (mode: CodexRuntimeMode) => void;
	onNewDraftRoute: () => Promise<void>;
}) {
	const [message, setMessage] = useState("");
	const [composerMode, setComposerMode] = useState<ComposerMode>("ask");
	const [contextItems, setContextItems] = useState<ComposerContextItem[]>(
		[],
	);
	const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
	const [resetSignal, setResetSignal] = useState(0);
	const openedDraftScopeRef = useRef<string | undefined>(undefined);
	const resetKeyRef = useRef<string | undefined>(props.resetKey);
	const sessionRef = useRef(props.session);

	useEffect(() => {
		sessionRef.current = props.session;
	}, [props.session]);

	const composerDraft = useMemo(() => {
		return createComposerDraft({
			text: message,
			mode: composerMode,
			model: props.model,
			runtimeMode: props.runtimeMode,
			contextItems,
			attachments,
		});
	}, [
		message,
		composerMode,
		props.model,
		props.runtimeMode,
		contextItems,
		attachments,
	]);

	useComposerDraftSync({
		draft: composerDraft,
		draftId: props.session.draftId,
		conversationId: props.session.conversationId,
		draftScopeId: props.session.draftId ?? props.draftScopeId,
		scopeKey: props.workspaceRoot,
		persistDraft: props.session.persistDraft,
	});

	useEffect(() => {
		if (!props.routeDraftId) {
			return;
		}
		if (openedDraftScopeRef.current === props.routeDraftId) {
			return;
		}
		openedDraftScopeRef.current = props.routeDraftId;
		resetComposer();
		void sessionRef.current.createNewSession();
	}, [props.routeDraftId]);

	useEffect(() => {
		if (!props.resetKey || resetKeyRef.current === props.resetKey) {
			return;
		}
		resetKeyRef.current = props.resetKey;
		resetComposer();
	}, [props.resetKey]);

	async function sendMessage(payload: ComposerPayload) {
		const payloadAdmission = admitComposerRequest({
			payload,
			model: props.model,
			runtimeMode: props.runtimeMode,
		});
		if (!payloadAdmission.ok) {
			props.session.reportComposerAdmissionBlock(payloadAdmission.reason);
			return false;
		}
		const sent = await props.session.sendAdmittedRequest(
			payloadAdmission.request,
		);
		if (sent) {
			resetComposer();
		}
		return sent;
	}

	function resetComposer() {
		setMessage("");
		setComposerMode("ask");
		setContextItems([]);
		setAttachments([]);
		setResetSignal((signal) => signal + 1);
	}

	return (
		<SessionComposer
			value={message}
			disabled={props.session.isTurnRunning}
			turnActive={props.session.isTurnActive}
			mode={composerMode}
			model={props.model}
			runtimeMode={props.runtimeMode}
			runtimeOptions={props.runtimeOptions}
			pendingRequests={props.session.pendingRequests}
			workspaceRoot={props.workspaceRoot}
			resetSignal={resetSignal}
			initialContextItems={contextItems}
			initialAttachments={attachments}
			onChange={setMessage}
			onModeChange={setComposerMode}
			onContextItemsChange={setContextItems}
			onAttachmentsChange={setAttachments}
			onModelChange={props.onModelChange}
			onRuntimeModeChange={props.onRuntimeModeChange}
			onSend={sendMessage}
			onInterrupt={props.session.interruptConversation}
			onNewSession={props.onNewDraftRoute}
			onRespondRequest={props.session.respondToRequest}
		/>
	);
}
