"use client";

import { Progress } from "@repo/ui/components/progress";
import { cn } from "@repo/ui/lib/utils";
import {
	type BookingTab,
	STEP_CONFIG,
	type StepConfig,
} from "./booking-form-schema";
import { StepIndicator, type StepStatus } from "./step-indicator";

interface BookingStepperSidebarProps {
	activeStep: BookingTab;
	completedSteps: Set<BookingTab>;
	stepsWithErrors: Record<BookingTab, boolean>;
	onStepClick: (step: BookingTab) => void | Promise<void>;
	canNavigateToStep: (step: BookingTab) => boolean;
	isNavigating?: boolean;
	className?: string;
}

/**
 * Vertical stepper sidebar for desktop view
 * Shows step progress, status indicators, and allows navigation
 */
export function BookingStepperSidebar({
	activeStep,
	completedSteps,
	stepsWithErrors,
	onStepClick,
	canNavigateToStep,
	isNavigating = false,
	className,
}: BookingStepperSidebarProps) {
	// Calculate progress percentage
	const completedCount = completedSteps.size;
	const totalSteps = STEP_CONFIG.length;
	const progressPercentage = Math.round((completedCount / totalSteps) * 100);

	// Determine step status
	const getStepStatus = (step: StepConfig): StepStatus => {
		if (stepsWithErrors[step.id]) {
			return "error";
		}
		if (step.id === activeStep) {
			return "current";
		}
		if (completedSteps.has(step.id)) {
			return "completed";
		}
		return "upcoming";
	};

	return (
		<div className={cn("space-y-6", className)}>
			{/* Progress Header */}
			<div className="space-y-2">
				<div className="flex items-center justify-between text-sm">
					<span className="text-muted-foreground">Progress</span>
					<span className="font-medium">{progressPercentage}%</span>
				</div>
				<Progress value={progressPercentage} className="h-2" />
				<p className="text-xs text-muted-foreground">
					{completedCount} of {totalSteps} steps completed
				</p>
			</div>

			{/* Step List */}
			<nav aria-label="Booking form steps" className="space-y-1">
				{STEP_CONFIG.map((step, index) => (
					<StepIndicator
						key={step.id}
						step={step}
						status={getStepStatus(step)}
						stepNumber={index + 1}
						onClick={() => void onStepClick(step.id)}
						isClickable={
							!isNavigating && canNavigateToStep(step.id)
						}
						showConnector={index < STEP_CONFIG.length - 1}
					/>
				))}
			</nav>
		</div>
	);
}
