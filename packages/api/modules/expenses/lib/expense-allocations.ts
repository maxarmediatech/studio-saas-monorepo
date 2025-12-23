import { ORPCError } from "@orpc/server";

const EPSILON = 0.01;

type AllocationMode = "none" | "percentage" | "amount";

type AllocationInput = {
	allocationPercentage?: string | null;
	allocationAmount?: string | null;
};

function parseValue(value: string | number | null | undefined): number {
	if (value === null || value === undefined) {
		return 0;
	}

	return Number(value);
}

export function validateExpenseAllocations(
	assignments: AllocationInput[],
	totalAmount: number,
): AllocationMode {
	if (assignments.length === 0) {
		return "none";
	}

	const hasPercentage = assignments.some((a) => a.allocationPercentage !== null && a.allocationPercentage !== undefined);
	const hasAmount = assignments.some((a) => a.allocationAmount !== null && a.allocationAmount !== undefined);

	if (hasPercentage && hasAmount) {
		throw new ORPCError("CONFLICT", {
			message: "Use either allocation percentages or allocation amounts, not both",
		});
	}

	if (!hasPercentage && !hasAmount) {
		if (assignments.length > 1) {
			throw new ORPCError("CONFLICT", {
				message: "Allocation is required when multiple assignments are provided",
			});
		}

		return "none";
	}

	if (hasPercentage) {
		let totalPercentage = 0;

		for (const assignment of assignments) {
			if (assignment.allocationAmount !== null && assignment.allocationAmount !== undefined) {
				throw new ORPCError("CONFLICT", {
					message: "Allocation amounts are not allowed when using percentages",
				});
			}

			if (assignment.allocationPercentage === null || assignment.allocationPercentage === undefined) {
				throw new ORPCError("CONFLICT", {
					message: "Allocation percentage is required for each assignment",
				});
			}

			totalPercentage += parseValue(assignment.allocationPercentage);
		}

		if (Math.abs(totalPercentage - 100) > EPSILON) {
			throw new ORPCError("CONFLICT", {
				message: "Allocation percentages must add up to 100",
			});
		}

		return "percentage";
	}

	let totalAllocation = 0;

	for (const assignment of assignments) {
		if (assignment.allocationPercentage !== null && assignment.allocationPercentage !== undefined) {
			throw new ORPCError("CONFLICT", {
				message: "Allocation percentages are not allowed when using amounts",
			});
		}

		if (assignment.allocationAmount === null || assignment.allocationAmount === undefined) {
			throw new ORPCError("CONFLICT", {
				message: "Allocation amount is required for each assignment",
			});
		}

		totalAllocation += parseValue(assignment.allocationAmount);
	}

	if (Math.abs(totalAllocation - totalAmount) > EPSILON) {
		throw new ORPCError("CONFLICT", {
			message: "Allocation amounts must add up to the expense amount",
		});
	}

	return "amount";
}

export function getAllocatedExpenseAmount(
	totalAmount: number,
	assignment: AllocationInput,
	mode: AllocationMode,
): number {
	if (mode === "percentage") {
		return (totalAmount * parseValue(assignment.allocationPercentage)) / 100;
	}

	if (mode === "amount") {
		return parseValue(assignment.allocationAmount);
	}

	return totalAmount;
}
