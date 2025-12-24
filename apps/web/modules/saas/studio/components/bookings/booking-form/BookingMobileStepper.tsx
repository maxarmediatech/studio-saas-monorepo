"use client";

import { cn } from "@repo/ui/lib/utils";
import { CheckIcon, AlertCircleIcon } from "lucide-react";
import { type BookingTab, STEP_CONFIG } from "./booking-form-schema";

interface BookingMobileStepperProps {
	activeStep: BookingTab;
	completedSteps: Set<BookingTab>;
	stepsWithErrors: Record<BookingTab, boolean>;
	onStepClick: (step: BookingTab) => void;
	className?: string;
}

/**
 * Horizontal stepper for mobile view
 * Shows numbered circles connected by lines with abbreviated labels
 */
export function BookingMobileStepper({
	activeStep,
	completedSteps,
	stepsWithErrors,
	onStepClick,
	className,
}: BookingMobileStepperProps) {
	const activeIndex = STEP_CONFIG.findIndex((s) => s.id === activeStep);

	return (
		<div className={cn("w-full", className)}>
			{/* Step indicators row */}
			<div className="flex items-center justify-between">
				{STEP_CONFIG.map((step, index) => {
					const isActive = step.id === activeStep;
					const isCompleted = completedSteps.has(step.id);
					const hasError = stepsWithErrors[step.id];
					const isBeforeActive = index < activeIndex;

					return (
						<div
							key={step.id}
							className="flex items-center flex-1 last:flex-none"
						>
							{/* Step dot */}
							<button
								type="button"
								onClick={() => onStepClick(step.id)}
								className={cn(
									"flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
									"text-xs font-medium transition-colors",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									isActive &&
										"bg-primary text-primary-foreground ring-2 ring-primary/20",
									isCompleted &&
										!hasError &&
										"bg-green-500 text-white",
									hasError && "bg-destructive text-destructive-foreground",
									!isActive &&
										!isCompleted &&
										!hasError &&
										"bg-muted text-muted-foreground"
								)}
								aria-current={isActive ? "step" : undefined}
								aria-label={`${step.label}${hasError ? " (has errors)" : isCompleted ? " (completed)" : ""}`}
							>
								{hasError ? (
									<AlertCircleIcon className="h-4 w-4" />
								) : isCompleted ? (
									<CheckIcon className="h-4 w-4" />
								) : (
									index + 1
								)}
							</button>

							{/* Connector line (except for last step) */}
							{index < STEP_CONFIG.length - 1 && (
								<div
									className={cn(
										"flex-1 h-0.5 mx-2",
										isBeforeActive || (isActive && isCompleted)
											? "bg-green-500"
											: "bg-border"
									)}
									aria-hidden="true"
								/>
							)}
						</div>
					);
				})}
			</div>

			{/* Current step label */}
			<div className="mt-2 text-center">
				<p className="text-sm font-medium">
					{STEP_CONFIG[activeIndex]?.label}
				</p>
				<p className="text-xs text-muted-foreground">
					Step {activeIndex + 1} of {STEP_CONFIG.length}
				</p>
			</div>
		</div>
	);
}
