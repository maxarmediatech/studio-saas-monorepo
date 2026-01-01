"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@repo/ui/components/badge";
import { Input } from "@repo/ui/components/input";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import {
	PencilIcon,
	TrashIcon,
	SearchIcon,
	Loader2Icon,
	SettingsIcon,
	CheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import { configurationsApi, configurationsMutations } from "@saas/studio/lib/api";
import {
	DataTable,
	DataTableRowActions,
	type RowAction,
} from "@saas/shared/components/data-table";
import type { Configuration } from "@repo/api/modules/studio/schemas/configuration";
import { useConfigurationParams } from "@saas/studio/hooks/params/use-configuration-params";
import { OpenConfigurationCreateSheet } from "./OpenConfigurationSheet";
import { PageContent } from "../PageContent";

interface ConfigurationsPageClientProps {
	organizationSlug: string;
	configType: string;
	configTypeLabel: string;
	pageTitle: string;
	pageDescription: string;
	initialFilters: {
		page: number;
		search?: string;
	};
}

export function ConfigurationsPageClient({
	organizationSlug,
	configType,
	configTypeLabel,
	pageTitle,
	pageDescription,
	initialFilters,
}: ConfigurationsPageClientProps) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [isPending, startTransition] = useTransition();

	const [searchValue, setSearchValue] = useState(initialFilters.search ?? "");
	const [currentFilters, setCurrentFilters] = useState(initialFilters);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [configToDelete, setConfigToDelete] = useState<Configuration | null>(null);

	// URL-based sheet params
	const { openEdit } = useConfigurationParams();

	// Build query input
	const queryInput = {
		type: configType as "booking_type" | "package_type" | "relation_type",
		page: currentFilters.page,
		limit: 50,
		search: currentFilters.search,
		sortBy: "sortOrder" as const,
		sortDirection: "asc" as const,
	};

	// Fetch configurations with TanStack Query
	const { data, isLoading, isFetching } = useQuery(
		configurationsApi.listOptions(queryInput)
	);

	const configurations = data?.data ?? [];
	const pagination = data?.pagination ?? { page: 1, limit: 50, total: 0, pageCount: 0 };

	// Delete mutation
	const deleteMutation = useMutation({
		...configurationsMutations.delete(),
		onSuccess: () => {
			toast.success(`${configTypeLabel} deleted successfully`);
			setDeleteDialogOpen(false);
			setConfigToDelete(null);
			queryClient.invalidateQueries({ queryKey: ["studio", "configurations"] });
		},
		onError: (error) => {
			toast.error(error.message || `Failed to delete ${configTypeLabel.toLowerCase()}`);
		},
	});

	const updateFilters = (updates: Partial<typeof currentFilters>) => {
		const newFilters = { ...currentFilters, ...updates };
		setCurrentFilters(newFilters);

		const params = new URLSearchParams();
		if (newFilters.page > 1) {
			params.set("page", String(newFilters.page));
		}
		if (newFilters.search) {
			params.set("search", newFilters.search);
		}

		const queryString = params.toString();
		const basePath = `/app/${organizationSlug}/settings/${configType.replace(/_/g, "-")}`;
		const url = `${basePath}${queryString ? `?${queryString}` : ""}`;

		startTransition(() => {
			router.push(url, { scroll: false });
		});
	};

	const handleSearch = () => {
		updateFilters({ search: searchValue || undefined, page: 1 });
	};

	const handlePaginationChange = (newPagination: typeof pagination) => {
		updateFilters({ page: newPagination.page });
	};

	const handleOpenEdit = (config: Configuration) => {
		openEdit(config.id, configType);
	};

	// Define row actions
	const rowActions: RowAction<Configuration>[] = [
		{
			label: "Edit",
			icon: <PencilIcon className="h-4 w-4" />,
			onClick: handleOpenEdit,
		},
		{
			label: "Delete",
			icon: <TrashIcon className="h-4 w-4" />,
			variant: "destructive",
			separator: true,
			onClick: (row) => {
				if (row.isSystem) {
					toast.error("Cannot delete system configurations");
					return;
				}
				setConfigToDelete(row);
				setDeleteDialogOpen(true);
			},
		},
	];

	// Define columns
	const columns: ColumnDef<Configuration>[] = useMemo(
		() => [
			{
				accessorKey: "label",
				header: "Label",
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						{row.original.color && (
							<div
								className="h-4 w-4 rounded-full border"
								style={{ backgroundColor: row.original.color }}
							/>
						)}
						<div>
							<p className="font-medium">{row.original.label}</p>
							<p className="text-xs text-muted-foreground font-mono">
								{row.original.key}
							</p>
						</div>
					</div>
				),
			},
			{
				accessorKey: "description",
				header: "Description",
				cell: ({ row }) => (
					<span className="text-muted-foreground truncate max-w-[250px] block">
						{row.original.description || "-"}
					</span>
				),
			},
			{
				accessorKey: "sortOrder",
				header: () => <div className="text-center">Order</div>,
				cell: ({ row }) => (
					<div className="text-center font-mono text-sm">
						{row.original.sortOrder}
					</div>
				),
			},
			{
				accessorKey: "isDefault",
				header: () => <div className="text-center">Default</div>,
				cell: ({ row }) => (
					<div className="flex justify-center">
						{row.original.isDefault && (
							<CheckIcon className="h-4 w-4 text-green-600" />
						)}
					</div>
				),
			},
			{
				accessorKey: "isSystem",
				header: () => <div className="text-center">Type</div>,
				cell: ({ row }) => (
					<div className="flex justify-center">
						<Badge variant={row.original.isSystem ? "secondary" : "outline"}>
							{row.original.isSystem ? "System" : "Custom"}
						</Badge>
					</div>
				),
			},
			{
				id: "actions",
				cell: ({ row }) => (
					<DataTableRowActions row={row.original} actions={rowActions} />
				),
			},
		],
		[],
	);

	const showLoading = isFetching || isPending;

	return (
		<PageContent title={pageTitle}>
			<div className="space-y-4">
				{/* Filters */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
					<div className="relative flex-1 max-w-sm">
						<SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder={`Search ${configTypeLabel.toLowerCase()}s...`}
							value={searchValue}
							onChange={(e) => setSearchValue(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleSearch()}
							className="pl-9"
						/>
					</div>

					<div className="ml-auto">
						<OpenConfigurationCreateSheet
							configurationType={configType}
							label={`Add ${configTypeLabel}`}
						/>
					</div>
				</div>

				{/* Table */}
				<DataTable
					columns={columns}
					data={configurations}
					isLoading={isLoading}
					isFetching={showLoading}
					pagination={pagination}
					onPaginationChange={handlePaginationChange}
					emptyState={
						<div className="flex flex-col items-center gap-2">
							<SettingsIcon className="h-12 w-12 text-muted-foreground/50" />
							<p className="text-muted-foreground">No {configTypeLabel.toLowerCase()}s found</p>
							<OpenConfigurationCreateSheet
								configurationType={configType}
								variant="outline"
								size="sm"
								label={`Add your first ${configTypeLabel.toLowerCase()}`}
							/>
						</div>
					}
				/>
			</div>

			{/* Delete confirmation dialog */}
			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {configTypeLabel.toLowerCase()}?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete "{configToDelete?.label}". This action cannot
							be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (configToDelete) {
									deleteMutation.mutate({ id: configToDelete.id });
								}
							}}
							disabled={deleteMutation.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{deleteMutation.isPending && (
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
							)}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</PageContent>
	);
}
