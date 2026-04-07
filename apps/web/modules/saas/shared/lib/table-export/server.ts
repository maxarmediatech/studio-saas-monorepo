import { createRouterClient } from "@orpc/server";
import type { ApiRouterClient } from "@repo/api/orpc/router";
import { router } from "@repo/api/orpc/router";
import { buildCsvContent, buildZipBuffer, resolveVisibleColumns } from "./format";
import { tableExportColumns } from "./definitions";
import type {
	TableExportEntity,
	TableExportFormat,
	TableExportPage,
	TableExportRequest,
} from "./types";

const EXPORT_PAGE_SIZE = 100;

function createApiClient(headers: Headers): ApiRouterClient {
	return createRouterClient(router, {
		context: () => ({ headers }),
	}) as ApiRouterClient;
}

async function collectAllPages<Row>(
	fetchPage: (page: number, limit: number) => Promise<TableExportPage<Row>>,
): Promise<Row[]> {
	const rows: Row[] = [];
	let page = 1;
	let pageCount = 1;

	do {
		const result = await fetchPage(page, EXPORT_PAGE_SIZE);
		rows.push(...result.data);
		pageCount = result.pagination.pageCount;
		page += 1;
	} while (page <= pageCount);

	return rows;
}

async function fetchEntityRows(
	client: ApiRouterClient,
	entityType: TableExportEntity,
	input: Record<string, unknown>,
) {
	switch (entityType) {
		case "booking":
			return collectAllPages((page, limit) =>
				client.bookings.list({ ...input, page, limit } as any),
			);
		case "client":
			return collectAllPages((page, limit) =>
				client.clients.list({ ...input, page, limit } as any),
			);
		case "configuration":
			return collectAllPages((page, limit) =>
				client.configurations.list({ ...input, page, limit } as any),
			);
		case "crew":
			return collectAllPages((page, limit) =>
				client.crews.list({ ...input, page, limit } as any),
			);
		case "deliverable":
			return collectAllPages((page, limit) =>
				client.deliverables.list({ ...input, page, limit } as any),
			);
		case "expense":
			return collectAllPages((page, limit) =>
				client.expenses.list({ ...input, page, limit } as any),
			);
		case "invoice":
			return collectAllPages((page, limit) =>
				client.invoices.list({ ...input, page, limit } as any),
			);
		case "payment":
			return collectAllPages((page, limit) =>
				client.studioPayments.listReceived({ ...input, page, limit } as any),
			);
		case "receipt":
			return collectAllPages((page, limit) =>
				client.receipts.list({ ...input, page, limit } as any),
			);
		case "schedule":
			return collectAllPages((page, limit) =>
				client.studioPayments.listSchedules({ ...input, page, limit } as any),
			);
		case "shoot":
			return collectAllPages((page, limit) =>
				client.shoots.list({ ...input, page, limit } as any),
			);
		case "task":
			return collectAllPages((page, limit) =>
				client.tasks.list({ ...input, page, limit } as any),
			);
	}
}

function buildFilename(entityType: TableExportEntity, format: TableExportFormat) {
	const timestamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
	return `${entityType}s-export-${timestamp}.${format}`;
}

export async function createTableExport(headers: Headers, request: TableExportRequest) {
	const client = createApiClient(headers);
	const rows = await fetchEntityRows(client, request.entityType, request.input);
	const columns = resolveVisibleColumns(
		tableExportColumns[request.entityType],
		request.columnVisibility,
	);
	const csvContent = buildCsvContent(columns, rows);

	if (request.format === "zip") {
		const csvFilename = buildFilename(request.entityType, "csv");
		return {
			body: buildZipBuffer(csvFilename, csvContent),
			contentType: "application/zip",
			filename: buildFilename(request.entityType, "zip"),
		};
	}

	return {
		body: csvContent,
		contentType: "text/csv; charset=utf-8",
		filename: buildFilename(request.entityType, "csv"),
	};
}
