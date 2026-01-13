"use client";

import { Skeleton } from "@repo/ui/components/skeleton";
import { stickiesApi, stickiesMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, StickyNoteIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StickyCard } from "./sticky-card";
import { StickyModal } from "./sticky-modal";

interface Sticky {
	id: string;
	title: string | null;
	content: string | null;
	color: string;
}

interface StickiesResponse {
	data: Sticky[];
}

export function StickiesWidget() {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingSticky, setEditingSticky] = useState<Sticky | null>(null);

	const { data, isLoading } = useQuery(stickiesApi.listOptions());
	const stickies = (data as unknown as StickiesResponse)?.data ?? [];

	const queryClient = useQueryClient();

	const deleteMutation = useMutation({
		...stickiesMutations.delete(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.stickies.key() });
			toast.success("Sticky deleted");
		},
		onError: () => {
			toast.error("Failed to delete sticky");
		},
	});

	const handleCreate = () => {
		setEditingSticky(null);
		setIsModalOpen(true);
	};

	const handleEdit = (sticky: Sticky) => {
		setEditingSticky(sticky);
		setIsModalOpen(true);
	};

	const handleDelete = (id: string) => {
		deleteMutation.mutate({ id });
	};

	if (isLoading) {
		return (
			<div className="py-4">
				<div className="flex items-center justify-between mb-2">
					<div className="text-sm font-semibold text-muted-foreground">
						Stickies
					</div>
					<Skeleton className="h-5 w-5 rounded-full" />
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={i} className="h-32 rounded-xl" />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="py-4">
			<div className="flex items-center justify-between mb-2">
				<div className="text-sm font-semibold text-muted-foreground">
					Stickies
				</div>
				<button
					type="button"
					onClick={handleCreate}
					className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
				>
					<PlusIcon className="size-4" />
					Add sticky
				</button>
			</div>

			<div className="mt-3 max-h-[400px] overflow-y-auto">
				{stickies.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-xl col-span-full">
						<StickyNoteIcon className="size-10 text-muted-foreground/30 mb-3" />
						<p className="text-sm text-muted-foreground">
							Jot down quick notes and reminders
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
						{stickies.map((sticky) => (
							<StickyCard
								key={sticky.id}
								sticky={sticky}
								onEdit={handleEdit}
								onDelete={handleDelete}
							/>
						))}
					</div>
				)}
			</div>

			<StickyModal
				isOpen={isModalOpen}
				onOpenChange={setIsModalOpen}
				initialData={editingSticky}
			/>
		</div>
	);
}
