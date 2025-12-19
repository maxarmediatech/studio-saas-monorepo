import { listExpenses } from "./procedures/list-expenses";
import { getExpense } from "./procedures/get-expense";
import { createExpense } from "./procedures/create-expense";
import { updateExpense } from "./procedures/update-expense";
import { deleteExpense } from "./procedures/delete-expense";
import { getExpenseStats } from "./procedures/get-expense-stats";

export const expensesRouter = {
	list: listExpenses,
	get: getExpense,
	create: createExpense,
	update: updateExpense,
	delete: deleteExpense,
	stats: getExpenseStats,
};
