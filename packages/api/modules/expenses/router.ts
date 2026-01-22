import { createExpense } from "./procedures/create-expense";
import { deleteExpense } from "./procedures/delete-expense";
import { getExpense } from "./procedures/get-expense";
import { getExpenseStats } from "./procedures/get-expense-stats";
import { listExpenses } from "./procedures/list-expenses";
import { listExpensesMinimal } from "./procedures/list-expenses-minimal";
import { updateExpense } from "./procedures/update-expense";

export const expensesRouter = {
	list: listExpenses,
	listMinimal: listExpensesMinimal,
	get: getExpense,
	create: createExpense,
	update: updateExpense,
	delete: deleteExpense,
	stats: getExpenseStats,
};
