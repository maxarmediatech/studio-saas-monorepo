"use client";

import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	stepName: string;
	/** Optional callback when error occurs */
	onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

/**
 * Error boundary for booking form steps.
 * Catches render errors and displays a recovery UI without crashing the entire form.
 */
export class BookingStepErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		// Log error for debugging
		console.error(`[BookingForm] Error in ${this.props.stepName} step:`, error, errorInfo);

		// Call optional error callback
		this.props.onError?.(error, errorInfo);
	}

	handleRetry = (): void => {
		this.setState({ hasError: false, error: null });
	};

	render(): ReactNode {
		if (this.state.hasError) {
			return (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-destructive">
							<AlertTriangleIcon className="size-5" />
							{this.props.stepName} Step Error
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<Alert variant="destructive">
							<AlertTriangleIcon className="size-4" />
							<AlertTitle>Something went wrong</AlertTitle>
							<AlertDescription>
								An error occurred while loading this step. Your draft has been
								saved. Please try again or contact support if the problem
								persists.
							</AlertDescription>
						</Alert>

						{process.env.NODE_ENV === "development" && this.state.error && (
							<div className="rounded-md bg-muted p-3">
								<p className="font-mono text-xs text-muted-foreground">
									{this.state.error.message}
								</p>
							</div>
						)}

						<Button onClick={this.handleRetry} variant="outline" size="sm">
							<RefreshCwIcon className="mr-2 size-4" />
							Try Again
						</Button>
					</CardContent>
				</Card>
			);
		}

		return this.props.children;
	}
}

/**
 * Root error display for API/submission errors (not render errors).
 * Shows at the top of the form when there's a root-level error.
 */
export function BookingFormRootError({
	message,
	onDismiss,
}: {
	message: string | undefined;
	onDismiss?: () => void;
}) {
	if (!message) return null;

	return (
		<Alert variant="destructive" className="mb-4">
			<AlertTriangleIcon className="size-4" />
			<AlertTitle>Error</AlertTitle>
			<AlertDescription className="flex items-start justify-between gap-2">
				<span>{message}</span>
				{onDismiss && (
					<Button
						variant="ghost"
						size="sm"
						className="h-auto p-0 text-destructive-foreground hover:text-destructive-foreground/80"
						onClick={onDismiss}
					>
						Dismiss
					</Button>
				)}
			</AlertDescription>
		</Alert>
	);
}
