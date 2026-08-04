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
import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
	type EventSide,
	QUOTATION_STEPS,
	type QuotationStepConfig,
	type QuotationStepId,
} from "./quotation-wizard-data";

export const sideLabels: Record<EventSide, string> = {
	common: "Common",
	bride: "Bride side",
	groom: "Groom side",
	both: "Both sides",
	separateCommon: "Separate common",
};

export function formatMoney(value: string) {
	const amount = Number(value.replace(/[^\d.]/g, ""));
	if (Number.isNaN(amount)) {
		return "INR 0";
	}
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(amount);
}

export function FieldBlock({
	label,
	children,
	className,
	error,
}: {
	label: string;
	children: ReactNode;
	className?: string;
	error?: string;
}) {
	return (
		<div className={cn("space-y-2", className)}>
			<span className="text-sm font-medium">{label}</span>
			{children}
			{error ? (
				<p className="text-sm text-destructive" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}

export function QuotationStepper({
	activeStep,
	completedSteps,
	onStepClick,
	primaryActionLabel,
	onPrimaryAction,
	onReset,
	saveStatus = "Draft saved",
}: {
	activeStep: QuotationStepId;
	completedSteps: Set<QuotationStepId>;
	onStepClick: (step: QuotationStepId) => void;
	primaryActionLabel?: string;
	onPrimaryAction?: () => void;
	onReset?: () => void;
	saveStatus?: "Unsaved" | "Saving" | "Draft saved" | "Could not save";
}) {
	const progress = Math.round(
		(completedSteps.size / QUOTATION_STEPS.length) * 100,
	);

	const getStatus = (step: QuotationStepConfig) => {
		if (step.id === activeStep) {
			return "current";
		}
		if (completedSteps.has(step.id)) {
			return "completed";
		}
		return "upcoming";
	};

	return (
		<div className="flex flex-col">
			<div className="space-y-2">
				<div className="flex items-center justify-between text-sm">
					<span className="text-muted-foreground">Progress</span>
					<span className="font-medium">{progress}%</span>
				</div>
				<Progress value={progress} className="h-2" />
				<div className="flex items-center justify-between text-xs text-muted-foreground">
					<span>
						{completedSteps.size} of {QUOTATION_STEPS.length} steps
						completed
					</span>
					<span className="flex items-center gap-1">
						<CheckIcon className="h-3 w-3" />
						{saveStatus}
					</span>
				</div>
			</div>
			<nav aria-label="Quotation steps" className="mt-6">
				{QUOTATION_STEPS.map((step, index) => {
					const Icon = step.icon;
					const status = getStatus(step);
					const connectorCompleted =
						status === "completed" || status === "current";

					return (
						<div key={step.id} className="relative flex">
							<div className="mr-3 flex flex-col items-center">
								<button
									type="button"
									onClick={() => onStepClick(step.id)}
									className={cn(
										"flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
										status === "upcoming" &&
											"border-2 border-muted-foreground/30 bg-background text-muted-foreground",
										status === "completed" &&
											"bg-primary text-primary-foreground",
										status === "current" &&
											"bg-primary text-primary-foreground ring-4 ring-primary/20",
									)}
									aria-current={
										status === "current"
											? "step"
											: undefined
									}
								>
									{status === "completed" ? (
										<CheckIcon className="h-4 w-4" />
									) : (
										<Icon className="h-4 w-4" />
									)}
								</button>
								{index < QUOTATION_STEPS.length - 1 && (
									<div
										className={cn(
											"min-h-4 w-0.5 flex-1",
											connectorCompleted
												? "bg-primary"
												: "bg-border",
										)}
										aria-hidden="true"
									/>
								)}
							</div>
							<button
								type="button"
								onClick={() => onStepClick(step.id)}
								className="flex min-w-0 flex-1 cursor-pointer flex-col items-start py-1 text-left transition-colors"
							>
								<span
									className={cn(
										"truncate text-sm font-medium",
										status === "current" && "text-primary",
										status === "completed" &&
											"text-foreground",
										status === "upcoming" &&
											"text-muted-foreground",
									)}
								>
									{step.label}
								</span>
								<span className="truncate text-xs text-muted-foreground">
									{step.description}
								</span>
							</button>
						</div>
					);
				})}
			</nav>
			{(onPrimaryAction || onReset) && (
				<div className="mt-6 space-y-2">
					{onPrimaryAction && (
						<Button
							type="button"
							className="w-full"
							onClick={onPrimaryAction}
						>
							{primaryActionLabel ?? "Review & Send"}
						</Button>
					)}
					{onReset && (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									type="button"
									variant="outline"
									className="w-full text-muted-foreground"
								>
									Reset
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>
										Reset quotation form?
									</AlertDialogTitle>
									<AlertDialogDescription>
										This clears the saved draft in this
										quotation and starts again.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>
										Cancel
									</AlertDialogCancel>
									<AlertDialogAction onClick={onReset}>
										Reset
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

export function QuotationMobileStepper({
	activeStep,
	completedSteps,
	onStepClick,
}: {
	activeStep: QuotationStepId;
	completedSteps: Set<QuotationStepId>;
	onStepClick: (step: QuotationStepId) => void;
}) {
	const activeIndex = QUOTATION_STEPS.findIndex(
		(step) => step.id === activeStep,
	);
	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-2">
				{QUOTATION_STEPS.map((step, index) => (
					<button
						type="button"
						key={step.id}
						onClick={() => onStepClick(step.id)}
						className={cn(
							"flex size-9 items-center justify-center rounded-full border text-xs font-medium",
							step.id === activeStep
								? "border-primary bg-primary text-primary-foreground"
								: completedSteps.has(step.id)
									? "border-primary text-primary"
									: "border-border text-muted-foreground",
						)}
					>
						{index + 1}
					</button>
				))}
			</div>
			<p className="text-center text-sm font-medium">
				{QUOTATION_STEPS[activeIndex]?.label}
			</p>
		</div>
	);
}

export function PreviewSection({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<section className="space-y-3">
			<h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
				{title}
			</h4>
			{children}
		</section>
	);
}

export function SummaryRow({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
			<span className="text-muted-foreground">{label}</span>
			<span className="font-medium">{value}</span>
		</div>
	);
}
