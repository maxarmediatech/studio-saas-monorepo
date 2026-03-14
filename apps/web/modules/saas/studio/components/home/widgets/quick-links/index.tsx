"use client";

import { Skeleton } from "@repo/ui/components/skeleton";
import { quickLinksApi, quickLinksMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinkIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { QuickLinkItem } from "./quick-link-item";
import { QuickLinkModal } from "./quick-link-modal";

interface QuickLink {
	id: string;
	url: string;
	title?: string | null;
}

interface QuickLinksResponse {
	data: QuickLink[];
}

export function QuickLinksWidget() {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingLink, setEditingLink] = useState<QuickLink | null>(null);

	const { data, isLoading } = useQuery(quickLinksApi.listOptions());

	const links = (data as unknown as QuickLinksResponse)?.data ?? [];

	const queryClient = useQueryClient();

	const deleteMutation = useMutation({
		...quickLinksMutations.delete(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.quickLinks.key() });
			toast.success("Quick link deleted");
		},
		onError: () => {
			toast.error("Failed to delete quick link");
		},
	});

	const handleCreate = () => {
		setEditingLink(null);
		setIsModalOpen(true);
	};

	const handleEdit = (link: QuickLink) => {
		setEditingLink(link);
		setIsModalOpen(true);
	};

	const handleDelete = (id: string) => {
		deleteMutation.mutate({ id });
	};

	if (isLoading) {
		return (
			<div className="py-4">
				<div className="mb-2 flex items-center justify-between">
					<div className="text-sm font-semibold text-muted-foreground">
						Quicklinks
					</div>
					<Skeleton className="h-5 w-5 rounded-full" />
				</div>
				<div className="flex flex-wrap gap-2 mt-3">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-8 w-28 rounded-lg" />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="py-4">
			<div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="text-sm font-semibold text-muted-foreground">
					Quicklinks
				</div>
				<button
					type="button"
					onClick={handleCreate}
					className="flex h-9 items-center gap-1 self-start rounded-md px-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5 hover:text-primary/80"
				>
					<PlusIcon className="size-4" />
					Add quick Link
				</button>
			</div>

			<div className="mt-3 md:max-h-[200px] md:overflow-y-auto">
				{links.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-xl bg-muted/30 px-4 py-10 text-center sm:py-12">
						<LinkIcon className="size-10 text-muted-foreground/30 mb-3" />
						<p className="text-sm text-muted-foreground">
							Keep important references, resources, or docs handy
							for your work
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
						{links.map((link) => (
							<QuickLinkItem
								key={link.id}
								link={link}
								onEdit={handleEdit}
								onDelete={handleDelete}
							/>
						))}
					</div>
				)}
			</div>

			<QuickLinkModal
				isOpen={isModalOpen}
				onOpenChange={setIsModalOpen}
				initialData={editingLink}
			/>
		</div>
	);
}
