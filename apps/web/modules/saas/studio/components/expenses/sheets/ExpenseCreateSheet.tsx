"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useBookingParams } from "@saas/studio/hooks/params";
import { useExpenseParams } from "@saas/studio/hooks/params/use-expense-params";
import { expensesMutations } from "@saas/studio/lib/api";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ExpenseForm, type ExpenseFormValues } from "../ExpenseForm";

export function ExpenseCreateSheet() {
	const { createExpense, close } = useExpenseParams();
	const { bookingId } = useBookingParams();
	const isOpen = Boolean(createExpense);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const createMutation = useMutation(expensesMutations.create());

	const handleSubmit = async (data: ExpenseFormValues) => {
		const assignment = { bookingId: data.bookingId };

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
			await createMutation.mutateAsync({
				description: data.description,
				amount: data.amount,
				expenseDate: data.expenseDate,
				category: data.category || undefined,
				billTo: data.billTo || undefined,
				paymentMethod: data.paymentMethod || undefined,
				vendor: data.vendor || undefined,
				notes: data.notes || undefined,
				metadata:
					Object.keys(metadata).length > 0 ? metadata : undefined,
				assignments:
					Object.keys(assignment).length > 0 ? [assignment] : undefined,
			});

			await queryClient.invalidateQueries({
				queryKey: orpc.expenses.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.bookings.key(),
			});
			toast.success("Expense added successfully");
			close();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to add expense";
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
					<SheetTitle className="text-xl">Add Expense</SheetTitle>
				</SheetHeader>
				<div className="flex-1 min-h-0">
					<ExpenseForm
						onSubmit={handleSubmit}
						mode="create"
						isPending={createMutation.isPending}
						onScrollChange={setIsScrolled}
						defaultBookingId={bookingId ?? undefined}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
