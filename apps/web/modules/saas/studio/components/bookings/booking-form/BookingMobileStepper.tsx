"use client";

import { cn } from "@repo/ui/lib/utils";
import { AlertCircleIcon, CheckIcon } from "lucide-react";
import { type BookingTab, STEP_CONFIG } from "./booking-form-schema";

interface BookingMobileStepperProps {
	activeStep: BookingTab;
	completedSteps: Set<BookingTab>;
	stepsWithErrors: Record<BookingTab, boolean>;
	onStepClick: (step: BookingTab) => void | Promise<void>;
	canNavigateToStep: (step: BookingTab) => boolean;
	isNavigating?: boolean;
	className?: string;
}

/**
 * Horizontal stepper for mobile view
 * Shows circles connected by lines with current step label
 */
export function BookingMobileStepper({
	activeStep,
	completedSteps,
	stepsWithErrors,
	onStepClick,
	canNavigateToStep,
	isNavigating = false,
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
					const isClickable =
						!isNavigating && canNavigateToStep(step.id);

					// Connector is filled if this step is completed or current
					const isConnectorFilled = isCompleted || isActive;

					return (
						<div
							key={step.id}
							className="flex items-center flex-1 last:flex-none"
						>
							{/* Step circle */}
							<button
								type="button"
								onClick={() => void onStepClick(step.id)}
								disabled={!isClickable}
								className={cn(
									"flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
									"text-xs font-medium transition-all duration-200",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
									// Current: primary with ring
									isActive &&
										"bg-primary text-primary-foreground ring-4 ring-primary/20",
									// Completed: primary filled
									isCompleted &&
										!isActive &&
										!hasError &&
										"bg-primary text-primary-foreground",
									// Error: destructive outline
									hasError &&
										"border-2 border-destructive bg-destructive/10 text-destructive",
									// Upcoming: outline
									!isActive &&
										!isCompleted &&
										!hasError &&
										"border-2 border-muted-foreground/30 bg-background text-muted-foreground",
									// Disabled state
									!isClickable &&
										"opacity-50 cursor-not-allowed",
									isClickable && "cursor-pointer",
								)}
								aria-current={isActive ? "step" : undefined}
								aria-label={`${step.label}${hasError ? " (has errors)" : isCompleted ? " (completed)" : ""}`}
							>
								{hasError ? (
									<AlertCircleIcon className="h-4 w-4" />
								) : isCompleted && !isActive ? (
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
										isConnectorFilled
											? "bg-primary"
											: "bg-border",
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
