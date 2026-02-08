import { addLineItem } from "./procedures/add-line-item";
import { cancelInvoice } from "./procedures/cancel";
import { createInvoice } from "./procedures/create";
import { createInvoiceFromSchedule } from "./procedures/create-from-schedule";
import { deleteInvoice } from "./procedures/delete";
import { getInvoice } from "./procedures/get-by-id";
import { listInvoices } from "./procedures/list";
import { markInvoiceSent } from "./procedures/mark-sent";
import { removeLineItem } from "./procedures/remove-line-item";
import { updateInvoice } from "./procedures/update";
import { updateLineItem } from "./procedures/update-line-item";

export const invoicesRouter = {
	list: listInvoices,
	get: getInvoice,
	create: createInvoice,
	createFromSchedule: createInvoiceFromSchedule,
	update: updateInvoice,
	markSent: markInvoiceSent,
	cancel: cancelInvoice,
	delete: deleteInvoice,

	addLineItem,
	updateLineItem,
	removeLineItem,
};
