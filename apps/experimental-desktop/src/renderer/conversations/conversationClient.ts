import type { RespondSessionRequestInput } from "../../preload/types";
import { stripNonDurableAttachmentFields } from "../../shared/composer-draft-envelope";
import type { ComposerTarget } from "../../shared/composer-target";
import type { ComposerDraftPersistInput } from "../components/composer/core/composerDraftSync";
import type { AdmittedComposerRequest } from "../components/composer/core/composerProviderTypes";
import {
	clearComposerDraft,
	createDraft,
	enqueueAdmittedMessage,
	executeNextConversationQueueItem,
	interruptConversation,
	listConversationQueueItems,
	loadComposerDraft,
	loadConversationDetail,
	promoteDraftAndSend,
	promoteDraftAndSendAdmitted,
	respondApproval,
	sendAdmittedMessage,
	sendConversationMessage,
	updateConversationQueueItem,
	updateDraft,
	upsertComposerDraft,
} from "./conversationTransport";

export type ConversationClientTransport = {
	loadConversationDetail: typeof loadConversationDetail;
	createDraft: typeof createDraft;
	updateDraft: typeof updateDraft;
	loadComposerDraft: typeof loadComposerDraft;
	upsertComposerDraft: typeof upsertComposerDraft;
	clearComposerDraft: typeof clearComposerDraft;
	promoteDraftAndSend: typeof promoteDraftAndSend;
	promoteDraftAndSendAdmitted: typeof promoteDraftAndSendAdmitted;
	sendConversationMessage: typeof sendConversationMessage;
	sendAdmittedMessage: typeof sendAdmittedMessage;
	enqueueAdmittedMessage: typeof enqueueAdmittedMessage;
	updateConversationQueueItem: typeof updateConversationQueueItem;
	listConversationQueueItems: typeof listConversationQueueItems;
	executeNextConversationQueueItem: typeof executeNextConversationQueueItem;
	interruptConversation: typeof interruptConversation;
	respondApproval: typeof respondApproval;
};

const defaultTransport: ConversationClientTransport = {
	loadConversationDetail,
	createDraft,
	updateDraft,
	loadComposerDraft,
	upsertComposerDraft,
	clearComposerDraft,
	promoteDraftAndSend,
	promoteDraftAndSendAdmitted,
	sendConversationMessage,
	sendAdmittedMessage,
	enqueueAdmittedMessage,
	updateConversationQueueItem,
	listConversationQueueItems,
	executeNextConversationQueueItem,
	interruptConversation,
	respondApproval,
};

export function createConversationClient(
	transport: ConversationClientTransport = defaultTransport,
) {
	async function persistDraft(input: {
		target: ComposerTarget;
		draft: ComposerDraftPersistInput;
		cwd?: string;
	}) {
		return transport.upsertComposerDraft({
			target: input.target,
			envelope: toComposerDraftEnvelope(input),
			...(input.cwd ? { cwd: input.cwd } : {}),
		});
	}

	function loadComposerDraftForTarget(input: { target: ComposerTarget }) {
		return transport.loadComposerDraft(input);
	}

	function clearComposerDraftForTarget(input: { target: ComposerTarget }) {
		return transport.clearComposerDraft(input);
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

	function listQueuedRequests(input: { conversationId: string }) {
		return transport.listConversationQueueItems(input.conversationId);
	}

	function executeNextQueuedRequest(input: { conversationId: string }) {
		return transport.executeNextConversationQueueItem(input.conversationId);
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
		loadComposerDraft: loadComposerDraftForTarget,
		persistDraft,
		clearComposerDraft: clearComposerDraftForTarget,
		sendAdmittedRequest,
		enqueueAdmittedRequest,
		cancelQueuedRequest,
		listQueuedRequests,
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

function toComposerDraftEnvelope(input: {
	target: ComposerTarget;
	draft: ComposerDraftPersistInput;
}) {
	const now = new Date().toISOString();
	const payload = input.draft.payload;
	return {
		version: 2 as const,
		target: input.target,
		input: {
			text: payload.text,
			mode: payload.mode,
			model: input.draft.model,
			runtimeMode: input.draft.runtimeMode,
			contextItems: payload.contextItems,
			attachments: stripNonDurableAttachmentFields(payload.attachments),
			selection: input.draft.selection,
			payload: {
				mode: payload.mode,
				text: payload.text,
				contextItems: payload.contextItems,
				attachments: stripNonDurableAttachmentFields(
					payload.attachments,
				),
				parts: payload.parts,
				metrics: payload.metrics,
				selection: input.draft.selection,
			},
		},
		pendingRequestAnswerDrafts:
			input.draft.pendingRequestAnswerDrafts ?? {},
		updatedAt: now,
	};
}
