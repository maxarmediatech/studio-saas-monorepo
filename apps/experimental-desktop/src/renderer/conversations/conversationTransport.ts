import type {
	CodexRuntimeMode,
	ConversationDetail,
	ConversationEvent,
	ConversationSummary,
	DraftRecord,
	RespondSessionRequestInput,
} from "../../preload/types";
import type { AdmittedComposerRequest } from "../components/composer/core/composerProviderTypes";

export type DraftPersistTransportInput = {
	text?: string;
	cwd?: string;
	model?: string;
	runtimeMode?: CodexRuntimeMode;
	attachments?: unknown[];
	payload?: unknown;
};

export type ConversationSendTransportInput = {
	text: string;
	model?: string;
	runtimeMode?: CodexRuntimeMode;
	nativeInput?: unknown[];
	payload?: unknown;
};

export function listConversationSummaries() {
	return window.experimentalDesktop.listConversations();
}

export function loadConversationDetail(conversationId: string) {
	return window.experimentalDesktop.getConversation(conversationId);
}

export function createDraft(input?: DraftPersistTransportInput) {
	return window.experimentalDesktop.createDraft(input);
}

export function updateDraft(
	draftId: string,
	input: DraftPersistTransportInput,
) {
	return window.experimentalDesktop.updateDraft(draftId, input);
}

export function promoteDraftAndSend(
	input: ConversationSendTransportInput & { draftId?: string; cwd?: string },
) {
	return window.experimentalDesktop.promoteDraftAndSend(input);
}

export function promoteDraftAndSendAdmitted(input: {
	draftId?: string;
	cwd?: string;
	request: AdmittedComposerRequest;
}) {
	return window.experimentalDesktop.promoteDraftAndSendAdmitted(input);
}

export function sendConversationMessage(
	conversationId: string,
	input: ConversationSendTransportInput,
) {
	return window.experimentalDesktop.sendConversationMessage(
		conversationId,
		input,
	);
}

export function sendAdmittedMessage(
	conversationId: string,
	input: { request: AdmittedComposerRequest },
) {
	return window.experimentalDesktop.sendAdmittedMessage(
		conversationId,
		input,
	);
}

export function enqueueAdmittedMessage(
	conversationId: string,
	input: { request: AdmittedComposerRequest },
) {
	return window.experimentalDesktop.enqueueAdmittedMessage(
		conversationId,
		input,
	);
}

export function interruptConversation(conversationId: string) {
	return window.experimentalDesktop.interruptConversation(conversationId);
}

export function respondApproval(
	conversationId: string,
	requestId: string,
	input: RespondSessionRequestInput,
) {
	return window.experimentalDesktop.respondApproval(
		conversationId,
		requestId,
		input,
	);
}

export function subscribeConversationEvents(
	conversationId: string,
	listener: (event: ConversationEvent) => void,
) {
	return window.experimentalDesktop.subscribeConversationEvents(
		conversationId,
		listener,
	);
}

export type ConversationDetailTransport = {
	listConversationSummaries: typeof listConversationSummaries;
	loadConversationDetail: typeof loadConversationDetail;
	createDraft: typeof createDraft;
	updateDraft: typeof updateDraft;
	promoteDraftAndSend: typeof promoteDraftAndSend;
	promoteDraftAndSendAdmitted: typeof promoteDraftAndSendAdmitted;
	sendConversationMessage: typeof sendConversationMessage;
	sendAdmittedMessage: typeof sendAdmittedMessage;
	enqueueAdmittedMessage: typeof enqueueAdmittedMessage;
	interruptConversation: typeof interruptConversation;
	respondApproval: typeof respondApproval;
	subscribeConversationEvents: typeof subscribeConversationEvents;
};

export type LoadedConversationDetail = NonNullable<ConversationDetail>;
export type LoadedConversationSummary = ConversationSummary;
export type LoadedDraftRecord = DraftRecord;
