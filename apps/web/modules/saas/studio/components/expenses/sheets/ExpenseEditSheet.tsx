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
import {
	expensesApi,
	expensesMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ExpenseForm, type ExpenseFormValues } from "../ExpenseForm";

export function ExpenseEditSheet() {
	const { expenseId, close } = useExpenseParams();
	const isOpen = Boolean(expenseId);
	const queryClient = useQueryClient();
	const [isScrolled, setIsScrolled] = useState(false);

	const { data: expense, isLoading } = useQuery({
		...expensesApi.getOptions(expenseId!),
		enabled: isOpen && !!expenseId,
	});

	const updateMutation = useMutation({
		...expensesMutations.update(),
		onSuccess: () => {
			toast.success("Expense updated successfully");
			queryClient.invalidateQueries({
				queryKey: studioQueryKeys.expenses.all,
			});
			close();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update expense");
		},
	});

	const handleSubmit = async (data: ExpenseFormValues) => {
		if (!expenseId) {
			return;
		}

		await updateMutation.mutateAsync({
			id: expenseId,
			description: data.description,
			amount: data.amount,
			expenseDate: data.expenseDate,
			category: data.category || null,
			billTo: data.billTo || undefined,
			paymentMethod: data.paymentMethod || null,
			vendor: data.vendor || null,
			transactionReference: data.transactionReference || null,
			notes: data.notes || null,
		});
	};

	return (
		<Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
			<SheetContent
				side="right"
				className="sm:max-w-md p-0 gap-0 flex flex-col"
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
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<div className="grid grid-cols-2 gap-4">
								<Skeleton className="h-10 w-full" />
								<Skeleton className="h-10 w-full" />
							</div>
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-24 w-full" />
						</div>
					) : (
						<ExpenseForm
							defaultValues={expense?.data}
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
