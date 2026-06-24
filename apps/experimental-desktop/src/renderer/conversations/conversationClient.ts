import type { RespondSessionRequestInput } from "../../preload/types";
import type { ComposerDraftPersistInput } from "../components/composer/core/composerDraftSync";
import type { AdmittedComposerRequest } from "../components/composer/core/composerProviderTypes";
import {
	createDraft,
	type DraftPersistTransportInput,
	enqueueAdmittedMessage,
	executeNextConversationQueueItem,
	interruptConversation,
	loadConversationDetail,
	promoteDraftAndSend,
	promoteDraftAndSendAdmitted,
	respondApproval,
	sendAdmittedMessage,
	sendConversationMessage,
	updateConversationQueueItem,
	updateDraft,
} from "./conversationTransport";

export type ConversationClientTransport = {
	loadConversationDetail: typeof loadConversationDetail;
	createDraft: typeof createDraft;
	updateDraft: typeof updateDraft;
	promoteDraftAndSend: typeof promoteDraftAndSend;
	promoteDraftAndSendAdmitted: typeof promoteDraftAndSendAdmitted;
	sendConversationMessage: typeof sendConversationMessage;
	sendAdmittedMessage: typeof sendAdmittedMessage;
	enqueueAdmittedMessage: typeof enqueueAdmittedMessage;
	updateConversationQueueItem: typeof updateConversationQueueItem;
	executeNextConversationQueueItem: typeof executeNextConversationQueueItem;
	interruptConversation: typeof interruptConversation;
	respondApproval: typeof respondApproval;
};

const defaultTransport: ConversationClientTransport = {
	loadConversationDetail,
	createDraft,
	updateDraft,
	promoteDraftAndSend,
	promoteDraftAndSendAdmitted,
	sendConversationMessage,
	sendAdmittedMessage,
	enqueueAdmittedMessage,
	updateConversationQueueItem,
	executeNextConversationQueueItem,
	interruptConversation,
	respondApproval,
};

export function createConversationClient(
	transport: ConversationClientTransport = defaultTransport,
) {
	async function persistDraft(input: {
		draftId?: string;
		draft: ComposerDraftPersistInput;
		cwd?: string;
	}) {
		const draftInput = toDraftPersistTransportInput(input);
		if (input.draftId) {
			return transport.updateDraft(input.draftId, draftInput);
		}
		return transport.createDraft(draftInput);
	}

	async function sendAdmittedRequest(input: {
		conversationId?: string;
		draftId?: string;
		cwd?: string;
		request: AdmittedComposerRequest;
	}) {
		assertSupportedProvider(input.request);
		if (input.conversationId) {
			return transport.sendAdmittedMessage(input.conversationId, {
				request: input.request,
			});
		}
		return transport.promoteDraftAndSendAdmitted({
			draftId: input.draftId,
			...(input.cwd ? { cwd: input.cwd } : {}),
			request: input.request,
		});
	}

	async function enqueueAdmittedRequest(input: {
		conversationId: string;
		request: AdmittedComposerRequest;
	}) {
		assertSupportedProvider(input.request);
		return transport.enqueueAdmittedMessage(input.conversationId, {
			request: input.request,
		});
	}

	function cancelQueuedRequest(input: { queueItemId: string }) {
		return transport.updateConversationQueueItem(input.queueItemId, {
			status: "canceled",
		});
	}

	function executeNextQueuedRequest(input: { conversationId: string }) {
		return transport.executeNextConversationQueueItem(
			input.conversationId,
		);
	}

	function respondToApproval(input: {
		conversationId: string;
		requestId: string;
		response: RespondSessionRequestInput;
	}) {
		return transport.respondApproval(
			input.conversationId,
			input.requestId,
			input.response,
		);
	}

	function interrupt(input: { conversationId: string }) {
		return transport.interruptConversation(input.conversationId);
	}

	return {
		loadConversationDetail: transport.loadConversationDetail,
		persistDraft,
		sendAdmittedRequest,
		enqueueAdmittedRequest,
		cancelQueuedRequest,
		executeNextQueuedRequest,
		respondToApproval,
		interrupt,
	};
}

function assertSupportedProvider(request: AdmittedComposerRequest) {
	if (request.providerInput.provider !== "codex") {
		throw new Error(
			`Unsupported provider: ${request.providerInput.provider}`,
		);
	}
}

export const conversationClient = createConversationClient();

function toDraftPersistTransportInput(input: {
	draft: ComposerDraftPersistInput;
	cwd?: string;
}): DraftPersistTransportInput {
	return {
		text: input.draft.payload.text,
		model: input.draft.model,
		runtimeMode: input.draft.runtimeMode,
		attachments: input.draft.payload.attachments,
		payload: {
			mode: input.draft.payload.mode,
			contextItems: input.draft.payload.contextItems,
			attachments: input.draft.payload.attachments,
			parts: input.draft.payload.parts,
			metrics: input.draft.payload.metrics,
		},
		...(input.cwd ? { cwd: input.cwd } : {}),
	};
}
