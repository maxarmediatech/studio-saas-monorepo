"use client";

import { Button } from "@repo/ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useExpenseParams } from "@saas/studio/hooks/params/use-expense-params";
import {
	expensesApi,
	expensesMutations,
	studioQueryKeys,
} from "@saas/studio/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { ExpenseForm, type ExpenseFormValues } from "../ExpenseForm";

export function ExpenseEditSheet() {
	const { expenseId, close } = useExpenseParams();
	const isOpen = Boolean(expenseId);
	const queryClient = useQueryClient();

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
			<SheetContent side="right" className="sm:max-w-md">
				<SheetHeader className="flex flex-row items-center justify-between mb-6">
					<SheetTitle className="text-xl">Edit Expense</SheetTitle>
					<Button
						size="icon"
						variant="ghost"
						onClick={close}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</SheetHeader>
				<div className="px-4">
					{isLoading ? (
						<div className="space-y-4">
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
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
