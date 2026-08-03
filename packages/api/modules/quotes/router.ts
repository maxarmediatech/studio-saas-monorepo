import { createQuote } from "./procedures/create";
import { deleteQuote } from "./procedures/delete";
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
import { updateQuote } from "./procedures/update";

export const quotesRouter = {
	list: listQuotes,
	get: getQuote,
	create: createQuote,
	update: updateQuote,
	delete: deleteQuote,
	send: sendQuote,
	revise: reviseQuote,
	accept: acceptQuote,
	decline: declineQuote,
	expire: expireQuote,
	convert: convertQuote,
};
