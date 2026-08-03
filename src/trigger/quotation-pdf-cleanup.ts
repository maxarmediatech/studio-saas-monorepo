import { cleanupUnreferencedQuotationPdfs } from "@repo/api/modules/quotes/lib/quotation-pdf-cleanup";
import { logger, schedules } from "@trigger.dev/sdk/v3";

export const cleanupQuotationPdfs = schedules.task({
	id: "cleanup-unreferenced-quotation-pdfs",
	cron: "17 3 * * *",
	maxDuration: 900,
	queue: { concurrencyLimit: 1 },
	run: async () => {
		const result = await cleanupUnreferencedQuotationPdfs();
		logger.info("Quotation PDF cleanup completed", result);
		return result;
	},
});
