import type { RespondSessionRequestInput } from "../../preload/types";
import type { ComposerDraftPersistInput } from "../components/composer/core/composerDraftSync";
import type { AdmittedComposerRequest } from "../components/composer/core/composerProviderTypes";
import { toCodexAdmittedSendInput } from "./codexAdmittedTransport";
import {
	createDraft,
	type DraftPersistTransportInput,
	interruptConversation,
	loadConversationDetail,
	promoteDraftAndSend,
	respondApproval,
	sendConversationMessage,
	updateDraft,
} from "./conversationTransport";

export type ConversationClientTransport = {
	loadConversationDetail: typeof loadConversationDetail;
	createDraft: typeof createDraft;
	updateDraft: typeof updateDraft;
	promoteDraftAndSend: typeof promoteDraftAndSend;
	sendConversationMessage: typeof sendConversationMessage;
	interruptConversation: typeof interruptConversation;
	respondApproval: typeof respondApproval;
};

const defaultTransport: ConversationClientTransport = {
	loadConversationDetail,
	createDraft,
	updateDraft,
	promoteDraftAndSend,
	sendConversationMessage,
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
		const codexInput = toCodexAdmittedSendInput(input.request);
		if (input.conversationId) {
			return transport.sendConversationMessage(
				input.conversationId,
				codexInput,
			);
		}
		return transport.promoteDraftAndSend({
			...codexInput,
			draftId: input.draftId,
			...(input.cwd ? { cwd: input.cwd } : {}),
		});
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
		respondToApproval,
		interrupt,
	};
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
