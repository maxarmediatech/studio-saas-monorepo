"use client";

import { useState } from "react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useExpenseParams } from "@saas/studio/hooks/params/use-expense-params";
import { expensesMutations, studioQueryKeys } from "@saas/studio/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExpenseForm, type ExpenseFormValues } from "../ExpenseForm";

export function ExpenseCreateSheet() {
	const { createExpense, close } = useExpenseParams();
	const isOpen = Boolean(createExpense);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const createMutation = useMutation({
		...expensesMutations.create(),
		onSuccess: () => {
			toast.success("Expense added successfully");
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.expenses.all,
			});
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to add expense");
		},
	});

	const handleSubmit = async (data: ExpenseFormValues) => {
		await createMutation.mutateAsync({
			description: data.description,
			amount: data.amount,
			expenseDate: data.expenseDate,
			category: data.category || undefined,
			billTo: data.billTo || undefined,
			paymentMethod: data.paymentMethod || undefined,
			vendor: data.vendor || undefined,
			transactionReference: data.transactionReference || undefined,
			notes: data.notes || undefined,
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent side="right" className="sm:max-w-md p-0 gap-0 flex flex-col">
				<SheetHeader
					className={cn(
						"shrink-0 p-4 transition-shadow duration-200",
						isScrolled && "shadow-[0_4px_12px_-4px_rgba(0,0,0,0.15)]"
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
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}
