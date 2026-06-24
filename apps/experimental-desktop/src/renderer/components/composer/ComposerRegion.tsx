import { useEffect, useRef } from "react";
import type {
	CodexRuntimeMode,
	RespondSessionRequestInput,
} from "../../../preload/types";
import type { PendingRequest, RuntimeOption } from "../../app/types";
import { useComposerDraftStore } from "./core/composerDraftStore";
import { useComposerDraftSync } from "./core/composerDraftSync";
import type { AdmittedComposerRequest } from "./core/composerProviderTypes";
import {
	createPendingQueueItem,
	type QueueValidationResult,
	useComposerQueueStore,
	validateQueueAdmission,
} from "./core/composerQueueStore";
import { admitComposerDraft } from "./core/composerSendController";
import { ComposerQueuePanel } from "./ComposerQueuePanel";
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
	enqueueAdmittedRequest: (
		request: AdmittedComposerRequest,
	) => Promise<
		| {
				id: string;
				conversationId: string;
				admittedRequestId: string;
				position: number;
				status: "queued";
				createdAt: string;
				updatedAt: string;
		  }
		| undefined
	>;
	cancelQueuedRequest: (queueItemId: string) => Promise<void>;
	executeNextQueuedRequest: () => Promise<unknown>;
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
	const queue = useComposerQueueStore();
	const openedDraftScopeRef = useRef<string | undefined>(undefined);
	const resetKeyRef = useRef<string | undefined>(props.resetKey);
	const sessionRef = useRef(props.session);
	const executingQueueItemRef = useRef<string | undefined>(undefined);

	useEffect(() => {
		sessionRef.current = props.session;
	}, [props.session]);

	useEffect(() => {
		if (
			!props.session.conversationId ||
			props.session.isTurnActive ||
			props.session.isTurnRunning ||
			queue.state.isPaused
		) {
			return;
		}
		const next = queue.state.items.find(
			(item) =>
				item.status === "queued" &&
				item.queueItemId !== executingQueueItemRef.current,
		);
		if (!next) {
			return;
		}
		executingQueueItemRef.current = next.queueItemId;
		queue.mark(next.queueItemId, "running");
		void props.session
			.executeNextQueuedRequest()
			.then(() => {
				queue.remove(next.queueItemId);
			})
			.catch((error) => {
				queue.mark(
					next.queueItemId,
					"failed",
					error instanceof Error ? error.message : String(error),
				);
			})
			.finally(() => {
				executingQueueItemRef.current = undefined;
			});
	}, [
		props.session.conversationId,
		props.session.isTurnActive,
		props.session.isTurnRunning,
		props.session.executeNextQueuedRequest,
		queue,
	]);

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
		if (shouldQueueInsteadOfSend()) {
			const queued = await enqueueRequest(payloadAdmission.request);
			if (queued) {
				composer.reset();
			}
			return queued;
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

	function shouldQueueInsteadOfSend() {
		return Boolean(
			props.session.conversationId &&
				props.session.isTurnRunning &&
				!props.routeDraftId,
		);
	}

	async function enqueueRequest(request: AdmittedComposerRequest) {
		const validation = validateQueueAdmission(queue.state, request);
		if (!validation.ok) {
			props.session.reportComposerAdmissionBlock(
				queueValidationMessage(validation.reason) ??
					"Could not queue request",
			);
			return false;
		}
		const serverItem = await props.session.enqueueAdmittedRequest(request);
		if (!serverItem) {
			return false;
		}
		queue.add(
			createPendingQueueItem({
				request,
				queueItemId: serverItem.id,
				position: serverItem.position,
				createdAt: serverItem.createdAt,
			}),
		);
		return true;
	}

	async function removeQueuedRequest(queueItemId: string) {
		await props.session.cancelQueuedRequest(queueItemId);
		queue.remove(queueItemId);
	}

	return (
		<SessionComposer
			value={composer.text}
			disabled={
				props.session.isTurnRunning && !props.session.conversationId
			}
			turnActive={props.session.isTurnActive}
			queueActive={shouldQueueInsteadOfSend()}
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
			queuePanel={
				<ComposerQueuePanel
					items={queue.state.items}
					isPaused={queue.state.isPaused}
					lastError={queue.state.lastError}
					onPause={queue.pause}
					onResume={queue.resume}
					onRemove={removeQueuedRequest}
					onMove={queue.move}
				/>
			}
		/>
	);
}

function queueValidationMessage(
	reason: Extract<QueueValidationResult, { ok: false }>["reason"],
) {
	switch (reason) {
		case "queueFull":
			return "Queue limit reached";
		case "inputTooLong":
			return "Queued request is too long";
		case "queueTooLarge":
			return "Queue is too large";
		case "emptyInput":
			return "Message required";
	}
}
