"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import { Progress } from "@repo/ui/components/progress";
import { cn } from "@repo/ui/lib/utils";
import { CheckIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";
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
	// Draft state
	isSaving?: boolean;
	lastSavedAt?: number | null;
	// Action button props
	onSubmit?: () => void;
	onReset?: () => void;
	isSubmitting?: boolean;
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
	isSaving = false,
	lastSavedAt,
	onSubmit,
	onReset,
	isSubmitting = false,
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

	// Determine if connector below a step should be primary colored
	// Connector is filled if this step is completed or current
	const isConnectorCompleted = (step: StepConfig): boolean => {
		const status = getStepStatus(step);
		return status === "completed" || status === "current";
	};

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Progress Header */}
			<div className="space-y-2">
				<div className="flex items-center justify-between text-sm">
					<span className="text-muted-foreground">Progress</span>
					<span className="font-medium">{progressPercentage}%</span>
				</div>
				<Progress value={progressPercentage} className="h-2" />
				<div className="flex items-center justify-between text-xs text-muted-foreground">
					<span>{completedCount} of {totalSteps} steps completed</span>
					{/* Draft save indicator */}
					{isSaving ? (
						<span className="flex items-center gap-1 text-muted-foreground">
							<Loader2Icon className="h-3 w-3 animate-spin" />
							Saving...
						</span>
					) : lastSavedAt ? (
						<span className="flex items-center gap-1 text-muted-foreground">
							<CheckIcon className="h-3 w-3" />
							Draft saved
						</span>
					) : null}
				</div>
			</div>

			{/* Step List */}
			<nav aria-label="Booking form steps" className="mt-6 flex-1">
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
						isConnectorCompleted={isConnectorCompleted(step)}
					/>
				))}
			</nav>

			{/* Action Buttons */}
			{(onSubmit || onReset) && (
				<div className="pt-4 mt-4 border-t space-y-2">
					{onSubmit && (
						<Button
							type="button"
							className="w-full"
							onClick={onSubmit}
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<>
									<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
									Creating...
								</>
							) : (
								"Create Booking"
							)}
						</Button>
					)}

					{onReset && (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									className="w-full text-muted-foreground"
									disabled={isSubmitting}
								>
									<RotateCcwIcon className="mr-2 h-4 w-4" />
									Reset Form
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										Reset booking form?
									</AlertDialogTitle>
									<AlertDialogDescription>
										This will clear all entered data and
										start fresh. This action cannot be
										undone.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction onClick={onReset}>
										Reset Form
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					)}
				</div>
			)}
		</div>
	);
}
