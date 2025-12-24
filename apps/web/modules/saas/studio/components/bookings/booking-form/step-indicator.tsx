"use client";

import { cn } from "@repo/ui/lib/utils";
import { CheckIcon, AlertCircleIcon } from "lucide-react";
import type { StepConfig } from "./booking-form-schema";

export type StepStatus = "completed" | "current" | "upcoming" | "error";

interface StepIndicatorProps {
	step: StepConfig;
	status: StepStatus;
	stepNumber: number;
	onClick: () => void;
	isClickable?: boolean;
	showConnector?: boolean;
}

export function StepIndicator({
	step,
	status,
	stepNumber,
	onClick,
	isClickable = true,
	showConnector = true,
}: StepIndicatorProps) {
	const Icon = step.icon;

	return (
		<div className="relative">
			<button
				type="button"
				onClick={onClick}
				disabled={!isClickable}
				className={cn(
					"group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5",
					"cursor-pointer transition-colors text-left",
					"hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					status === "current" && "bg-primary/10",
					status === "error" && "bg-destructive/5",
					!isClickable && "cursor-default opacity-50"
				)}
				aria-current={status === "current" ? "step" : undefined}
			>
				{/* Step indicator circle */}
				<div
					className={cn(
						"flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
						"border-2 transition-colors",
						status === "current" &&
							"border-primary bg-primary text-primary-foreground",
						status === "completed" &&
							"border-green-500 bg-green-500 text-white",
						status === "upcoming" &&
							"border-muted-foreground/30 bg-background text-muted-foreground",
						status === "error" &&
							"border-destructive bg-destructive/10 text-destructive"
					)}
				>
					{status === "completed" ? (
						<CheckIcon className="h-4 w-4" />
					) : status === "error" ? (
						<AlertCircleIcon className="h-4 w-4" />
					) : (
						<Icon className="h-4 w-4" />
					)}
				</div>

				{/* Step label and description */}
				<div className="flex flex-col items-start min-w-0">
					<span
						className={cn(
							"text-sm font-medium truncate",
							status === "current" && "text-primary",
							status === "completed" && "text-foreground",
							status === "upcoming" && "text-muted-foreground",
							status === "error" && "text-destructive"
						)}
					>
						{step.label}
					</span>
					<span className="text-xs text-muted-foreground truncate">
						{step.description}
					</span>
				</div>
			</button>

			{/* Connector line to next step */}
			{showConnector && (
				<div
					className={cn(
						"absolute left-[27px] top-[44px] h-4 w-0.5",
						status === "completed" ? "bg-green-500" : "bg-border"
					)}
					aria-hidden="true"
				/>
			)}
		</div>
	);
}
