"use client";

import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import type {
	TableExportEntity,
	TableExportFormat,
} from "@saas/shared/lib/table-export/types";
import type { VisibilityState } from "@tanstack/react-table";
import {
	DownloadIcon,
	FileArchiveIcon,
	FileSpreadsheetIcon,
	Loader2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DataTableExportButtonProps {
	entityType: TableExportEntity;
	input: Record<string, unknown>;
	columnVisibility?: VisibilityState;
	iconOnly?: boolean;
}

function triggerDownload(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.append(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

export function DataTableExportButton({
	entityType,
	input,
	columnVisibility,
	iconOnly = false,
}: DataTableExportButtonProps) {
	const [exportingFormat, setExportingFormat] =
		useState<TableExportFormat | null>(null);

	const handleExport = async (format: TableExportFormat) => {
		setExportingFormat(format);

		try {
			const response = await fetch("/api/table-export", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					entityType,
					format,
					input,
					columnVisibility,
				}),
			});

			if (!response.ok) {
				throw new Error(`Export failed with status ${response.status}`);
			}

			const blob = await response.blob();
			const disposition = response.headers.get("Content-Disposition");
			const filenameMatch = disposition?.match(/filename="([^"]+)"/);
			const filename = filenameMatch?.[1] ?? `${entityType}-export.${format}`;

			triggerDownload(blob, filename);
		} catch (error) {
			console.error(error);
			toast.error(`Failed to export ${entityType}s`);
		} finally {
			setExportingFormat(null);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className={iconOnly ? "h-8 w-8 p-0" : "h-8"}
					disabled={exportingFormat !== null}
					aria-label={iconOnly ? "Export" : undefined}
					title={iconOnly ? "Export" : undefined}
				>
					{exportingFormat ? (
						<Loader2Icon className="h-4 w-4 animate-spin" />
					) : (
						<DownloadIcon className="h-4 w-4" />
					)}
					{!iconOnly && <span className="ml-2">Export</span>}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => handleExport("csv")}>
					<FileSpreadsheetIcon className="mr-2 h-4 w-4" />
					CSV
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => handleExport("zip")}>
					<FileArchiveIcon className="mr-2 h-4 w-4" />
					ZIP
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
