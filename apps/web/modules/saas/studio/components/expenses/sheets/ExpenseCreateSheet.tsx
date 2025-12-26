"use client";

import { Button } from "@repo/ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { useExpenseParams } from "@saas/studio/hooks/params/use-expense-params";
import { expensesMutations, studioQueryKeys } from "@saas/studio/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { ExpenseForm, type ExpenseFormValues } from "../ExpenseForm";

export function ExpenseCreateSheet() {
	const { createExpense, close } = useExpenseParams();
	const isOpen = Boolean(createExpense);
	const queryClient = useQueryClient();

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
			<SheetContent side="right" className="sm:max-w-lg">
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<SheetTitle className="text-xl">Add Expense</SheetTitle>
					<Button
						size="icon"
						variant="ghost"
						onClick={close}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</SheetHeader>
				<ExpenseForm
					onSubmit={handleSubmit}
					mode="create"
					isPending={createMutation.isPending}
				/>
			</SheetContent>
		</Sheet>
	);
}
