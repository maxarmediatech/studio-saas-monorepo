import { createReceiptFromPayment } from "./procedures/create-from-payment";
import { getReceipt } from "./procedures/get-by-id";
import { listReceipts } from "./procedures/list";
import { voidReceipt } from "./procedures/void";

export const receiptsRouter = {
	list: listReceipts,
	get: getReceipt,
	createFromPayment: createReceiptFromPayment,
	void: voidReceipt,
};
