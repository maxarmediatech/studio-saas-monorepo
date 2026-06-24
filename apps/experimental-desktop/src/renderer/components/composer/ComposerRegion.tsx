import { useEffect, useRef } from "react";
import type {
	CodexRuntimeMode,
	RespondSessionRequestInput,
} from "../../../preload/types";
import type { PendingRequest, RuntimeOption } from "../../app/types";
import { useComposerDraftStore } from "./core/composerDraftStore";
import { useComposerDraftSync } from "./core/composerDraftSync";
import type { AdmittedComposerRequest } from "./core/composerProviderTypes";
import { admitComposerDraft } from "./core/composerSendController";
import { SessionComposer } from "./SessionComposer";

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
	onDraftSendStarted?: (draftId: string) => void;
	onDraftSendFailed?: (draftId: string) => void;
}) {
	const composer = useComposerDraftStore({
		model: props.model,
		runtimeMode: props.runtimeMode,
	});
	const openedDraftScopeRef = useRef<string | undefined>(undefined);
	const resetKeyRef = useRef<string | undefined>(props.resetKey);
	const sessionRef = useRef(props.session);

	useEffect(() => {
		sessionRef.current = props.session;
	}, [props.session]);

	useComposerDraftSync({
		draft: composer.draft,
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
		composer.reset();
		void sessionRef.current.createNewSession();
	}, [props.routeDraftId, composer.reset]);

	useEffect(() => {
		if (!props.resetKey || resetKeyRef.current === props.resetKey) {
			return;
		}
		resetKeyRef.current = props.resetKey;
		composer.reset();
	}, [props.resetKey, composer.reset]);

	async function sendMessage() {
		if (props.routeDraftId) {
			props.onDraftSendStarted?.(props.routeDraftId);
		}
		const payloadAdmission = admitComposerDraft({
			draft: composer.draft,
		});
		if (!payloadAdmission.ok) {
			if (props.routeDraftId) {
				props.onDraftSendFailed?.(props.routeDraftId);
			}
			props.session.reportComposerAdmissionBlock(payloadAdmission.reason);
			return false;
		}
		const sent = await props.session.sendAdmittedRequest(
			payloadAdmission.request,
		);
		if (sent) {
			composer.reset();
		} else if (props.routeDraftId) {
			props.onDraftSendFailed?.(props.routeDraftId);
		}
		return sent;
	}

	return (
		<SessionComposer
			value={composer.text}
			disabled={props.session.isTurnRunning}
			turnActive={props.session.isTurnActive}
			mode={composer.mode}
			model={props.model}
			runtimeMode={props.runtimeMode}
			runtimeOptions={props.runtimeOptions}
			pendingRequests={props.session.pendingRequests}
			workspaceRoot={props.workspaceRoot}
			resetSignal={composer.resetSignal}
			initialContextItems={composer.contextItems}
			initialAttachments={composer.attachments}
			onChange={composer.setText}
			onModeChange={composer.setMode}
			onContextItemsChange={composer.setContextItems}
			onAttachmentsChange={composer.setAttachments}
			onModelChange={props.onModelChange}
			onRuntimeModeChange={props.onRuntimeModeChange}
			onSend={sendMessage}
			onInterrupt={props.session.interruptConversation}
			onNewSession={props.onNewDraftRoute}
			onRespondRequest={props.session.respondToRequest}
		/>
	);
}
