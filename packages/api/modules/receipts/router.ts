import { createReceiptFromPayment } from "./procedures/create-from-payment";
import { generateReceiptFromReceived } from "./procedures/generate-from-received";
import { getReceipt } from "./procedures/get-by-id";
import { listReceipts } from "./procedures/list";
import { voidReceipt } from "./procedures/void";

export const receiptsRouter = {
	list: listReceipts,
	get: getReceipt,
	createFromPayment: createReceiptFromPayment,
	generateFromReceived: generateReceiptFromReceived,
	void: voidReceipt,
};
