"use client";

import { cn } from "@repo/ui/lib/utils";
import { AlertCircleIcon, CheckIcon } from "lucide-react";
import type { StepConfig } from "./booking-form-schema";

export type StepStatus = "completed" | "current" | "upcoming" | "error";

interface StepIndicatorProps {
	step: StepConfig;
	status: StepStatus;
	stepNumber: number;
	onClick: () => void;
	isClickable?: boolean;
	showConnector?: boolean;
	isConnectorCompleted?: boolean;
}

export function StepIndicator({
	step,
	status,
	stepNumber: _stepNumber,
	onClick,
	isClickable = true,
	showConnector = true,
	isConnectorCompleted = false,
}: StepIndicatorProps) {
	const Icon = step.icon;

	return (
		<div className="relative flex">
			{/* Left side: Circle + Connector */}
			<div className="flex flex-col items-center mr-3">
				{/* Circle */}
				<button
					type="button"
					onClick={onClick}
					disabled={!isClickable}
					className={cn(
						"flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
						"transition-all duration-200",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
						// Upcoming: outline style
						status === "upcoming" &&
							"border-2 border-muted-foreground/30 bg-background text-muted-foreground",
						// Completed: filled primary
						status === "completed" &&
							"bg-primary text-primary-foreground",
						// Current: filled primary with ring
						status === "current" &&
							"bg-primary text-primary-foreground ring-4 ring-primary/20",
						// Error: destructive outline
						status === "error" &&
							"border-2 border-destructive bg-destructive/10 text-destructive",
						// Disabled state
						!isClickable && "cursor-not-allowed opacity-50",
						isClickable && "cursor-pointer",
					)}
					aria-current={status === "current" ? "step" : undefined}
				>
					{status === "completed" ? (
						<CheckIcon className="h-4 w-4" />
					) : status === "error" ? (
						<AlertCircleIcon className="h-4 w-4" />
					) : (
						<Icon className="h-4 w-4" />
					)}
				</button>

				{/* Connector line below */}
				{showConnector && (
					<div
						className={cn(
							"w-0.5 flex-1 min-h-4",
							isConnectorCompleted ? "bg-primary" : "bg-border",
						)}
						aria-hidden="true"
					/>
				)}
			</div>

			{/* Right side: Label + Description */}
			<button
				type="button"
				onClick={onClick}
				disabled={!isClickable}
				className={cn(
					"flex flex-col items-start text-left py-1 flex-1 min-w-0",
					"transition-colors",
					!isClickable && "cursor-not-allowed",
					isClickable && "cursor-pointer",
				)}
			>
				<span
					className={cn(
						"text-sm font-medium truncate",
						status === "current" && "text-primary",
						status === "completed" && "text-foreground",
						status === "upcoming" && "text-muted-foreground",
						status === "error" && "text-destructive",
					)}
				>
					{step.label}
				</span>
				<span className="text-xs text-muted-foreground truncate">
					{step.description}
				</span>
			</button>
		</div>
	);
}
