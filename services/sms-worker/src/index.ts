import { logger } from "@repo/logs";
import { createSmsWorker } from "./worker";

const pollIntervalMs = Number(process.env.SMS_OUTBOX_INTERVAL_MS ?? 5000);
const batchSize = Number(process.env.SMS_OUTBOX_BATCH_SIZE ?? 10);

const worker = createSmsWorker({
	pollIntervalMs,
	batchSize,
});
let isShuttingDown = false;

async function run() {
	logger.info(
		{ pollIntervalMs, batchSize },
		`SMS worker starting, polling every ${pollIntervalMs}ms`,
	);

	const shutdownWithExit = async (reason: string, exitCode: 0 | 1) => {
		if (isShuttingDown) {
			return;
		}
		isShuttingDown = true;

		logger.info({ reason }, "Stopping SMS worker");

		try {
			await worker.shutdown();
			process.exit(exitCode);
		} catch (error) {
			logger.error({ reason, error }, "SMS worker shutdown failed");
			process.exit(1);
		}
	};

	process.on("SIGTERM", () => {
		void shutdownWithExit("SIGTERM", 0);
	});
	process.on("SIGINT", () => {
		void shutdownWithExit("SIGINT", 0);
	});
	process.on("unhandledRejection", (reason) => {
		logger.error({ reason }, "Unhandled promise rejection");
		void shutdownWithExit("unhandledRejection", 1);
	});
	process.on("uncaughtException", (error) => {
		logger.error({ error }, "Uncaught exception");
		void shutdownWithExit("uncaughtException", 1);
	});

	await worker.start();
	logger.info({ workerId: worker.getWorkerId() }, "SMS worker started");
}

run().catch((error) => {
	logger.error({ error }, "SMS worker failed to start");
	process.exit(1);
});
