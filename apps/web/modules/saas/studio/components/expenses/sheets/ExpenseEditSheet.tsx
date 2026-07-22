"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useExpenseParams } from "@saas/studio/hooks/params/use-expense-params";
import { expensesApi, expensesMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ExpenseForm, type ExpenseFormValues } from "../ExpenseForm";

export function ExpenseEditSheet() {
	const { expenseId, close } = useExpenseParams();
	const isOpen = Boolean(expenseId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const { data: expense, isLoading } = useQuery({
		...expensesApi.getOptions(expenseId ?? ""),
		enabled: isOpen && !!expenseId,
	});

	const updateMutation = useMutation(expensesMutations.update());

	const { bookingInfo, crewIdsFromMetadata } = useMemo(() => {
		const assignments = expense?.data?.assignments ?? [];
		const metadata = expense?.data?.metadata as {
			crewIds?: string[];
			receiptAttachment?: unknown;
			shootId?: string;
		} | null;

		const bookingAssignment = assignments.find(
			(a) => a.bookingId && !a.shootId,
		);
		const shootAssignment = assignments.find((a) => a.shootId);

		const assignmentWithBooking = bookingAssignment ?? shootAssignment;
		const bookingInfo = assignmentWithBooking?.bookingId
			? {
					id: assignmentWithBooking.bookingId,
					name: assignmentWithBooking.bookingName ?? "",
					referenceNumber:
						assignmentWithBooking.bookingReferenceNumber ?? "",
				}
			: undefined;

		const crewIdsFromMetadata = metadata?.crewIds ?? [];

		return { bookingInfo, crewIdsFromMetadata };
	}, [expense?.data?.assignments, expense?.data?.metadata]);

	const handleSubmit = async (data: ExpenseFormValues) => {
		if (!expenseId) {
			return;
		}

		const metadata: Record<string, unknown> = {};
		if (data.receiptAttachment) {
			metadata.receiptAttachment = data.receiptAttachment;
		}
		if (data.crewAssignments && data.crewAssignments.length > 0) {
			metadata.crewIds = data.crewAssignments.map((c) => c.crewId);
		}
		if (data.shootId) {
			metadata.shootId = data.shootId;
		}

		try {
			await updateMutation.mutateAsync({
				id: expenseId,
				description: data.description,
				amount: data.amount,
				expenseDate: data.expenseDate,
				category: data.category || null,
				billTo: data.billTo || undefined,
				paymentMethod: data.paymentMethod || null,
				vendor: data.vendor || null,
				notes: data.notes || null,
				metadata: Object.keys(metadata).length > 0 ? metadata : null,
			});

			await queryClient.invalidateQueries({
				queryKey: orpc.expenses.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.bookings.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.activities.key(),
			});
			toast.success("Expense updated successfully");
			close();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to update expense";
			toast.error(message);
		}
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent
				side="right"
				className="sm:max-w-xl p-0 gap-0 flex flex-col"
			>
				<SheetHeader
					className={cn(
						"shrink-0 p-4 transition-shadow duration-200",
						isScrolled &&
							"shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]",
					)}
				>
					<SheetTitle className="text-xl">Edit Expense</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					{isLoading ? (
						<div className="space-y-4 px-4 py-4">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<div className="grid grid-cols-3 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-24 w-full" />
						</div>
					) : (
						<ExpenseForm
							defaultValues={expense?.data}
							existingAssignments={expense?.data?.assignments}
							booking={bookingInfo}
							crewIdsFromMetadata={crewIdsFromMetadata}
							onSubmit={handleSubmit}
							mode="edit"
							isPending={updateMutation.isPending}
							onScrollChange={setIsScrolled}
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
