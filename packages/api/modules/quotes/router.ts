import { createQuote } from "./procedures/create";
import { deleteQuote } from "./procedures/delete";
import {
	createDocumentQuote,
	saveDocumentQuote,
	searchContacts,
	sendDocumentQuote,
} from "./procedures/document";
import { getQuote } from "./procedures/get";
import {
	acceptQuote,
	convertQuote,
	declineQuote,
	expireQuote,
	reviseQuote,
	sendQuote,
} from "./procedures/lifecycle";
import { listQuotes } from "./procedures/list";
import {
	chooseQuotationTemplate,
	listQuotationTemplates,
	readQuotationPresentation,
	retryQuotationRender,
	returnQuotationRenderToDraft,
	startQuotationSend,
} from "./procedures/presentation";
import { updateQuote } from "./procedures/update";

export const quotesRouter = {
	list: listQuotes,
	get: getQuote,
	create: createQuote,
	createDocument: createDocumentQuote,
	saveDocument: saveDocumentQuote,
	sendDocument: sendDocumentQuote,
	searchContacts,
	listTemplates: listQuotationTemplates,
	getPresentation: readQuotationPresentation,
	selectTemplate: chooseQuotationTemplate,
	startPresentationSend: startQuotationSend,
	retryPresentationRender: retryQuotationRender,
	returnPresentationToDraft: returnQuotationRenderToDraft,
	update: updateQuote,
	delete: deleteQuote,
	send: sendQuote,
	revise: reviseQuote,
	accept: acceptQuote,
	decline: declineQuote,
	expire: expireQuote,
	convert: convertQuote,
};
