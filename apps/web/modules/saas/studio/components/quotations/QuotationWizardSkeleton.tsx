import { Skeleton } from "@repo/ui/components/skeleton";

const STEPS = ["Clients", "Details", "Packages", "Terms", "Preview"];

export function QuotationWizardSkeleton() {
	return (
		<output
			className="flex min-h-[calc(100dvh-1rem)] flex-1 flex-col"
			aria-label="Loading quotation editor"
		>
			<div className="flex flex-1 flex-col overflow-hidden rounded-lg border bg-background">
				<header className="shrink-0 border-b bg-background">
					<div className="flex h-14 items-center justify-between px-4 sm:h-16 lg:px-6">
						<div className="flex items-center gap-2">
							<Skeleton className="size-8 rounded-lg" />
							<h1 className="text-lg font-semibold">
								New Quotation
							</h1>
						</div>
						<Skeleton className="h-9 w-16" />
					</div>
				</header>

				<div className="shrink-0 space-y-3 border-b bg-background px-4 py-3 md:hidden">
					<div className="flex items-center justify-between gap-2">
						{STEPS.map((step, index) => (
							<Skeleton
								className="size-9 rounded-full"
								key={step}
								aria-label={`Loading step ${index + 1}`}
							/>
						))}
					</div>
					<Skeleton className="mx-auto h-4 w-16" />
				</div>

				<div className="flex min-h-0 flex-1 flex-col md:flex-row">
					<main className="flex min-h-0 flex-1 flex-col overflow-hidden">
						<div className="min-h-0 flex-1 overflow-hidden">
							<div className="mx-auto max-w-4xl space-y-4 px-4 py-6 lg:px-6">
								<Skeleton className="h-7 w-36" />
								<div className="space-y-6 rounded-xl border p-6">
									<div className="overflow-hidden rounded-lg border bg-muted/10">
										<div className="flex h-12 items-center gap-2 border-b bg-muted/20 px-4">
											<Skeleton className="size-4 rounded-full" />
											<Skeleton className="h-4 w-16" />
										</div>
										<div className="space-y-4 p-4">
											<div className="grid gap-3 md:grid-cols-2">
												<FieldSkeleton />
												<FieldSkeleton />
											</div>
											<div className="grid gap-3 md:grid-cols-2">
												<FieldSkeleton />
												<FieldSkeleton />
											</div>
											<FieldSkeleton multiline />
											<Skeleton className="h-9 w-36" />
										</div>
									</div>
									<Skeleton className="h-9 w-40" />
								</div>
								<Skeleton className="h-7 w-44" />
								<div className="grid gap-3 md:grid-cols-2">
									<FieldSkeleton />
									<FieldSkeleton />
								</div>
							</div>
						</div>

						<footer className="shrink-0 border-t bg-background">
							<div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 lg:px-6">
								<Skeleton className="h-9 w-24" />
								<Skeleton className="h-9 w-20" />
							</div>
						</footer>
					</main>

					<aside className="hidden w-64 shrink-0 flex-col border-l bg-muted/30 md:flex lg:w-72 xl:w-80">
						<div className="flex-1 space-y-6 p-4 lg:p-6">
							<div className="space-y-2">
								<div className="flex justify-between">
									<Skeleton className="h-4 w-16" />
									<Skeleton className="h-4 w-8" />
								</div>
								<Skeleton className="h-2 w-full" />
								<Skeleton className="h-3 w-40" />
							</div>
							<div className="space-y-4">
								{STEPS.map((step) => (
									<div
										className="flex items-center gap-3"
										key={step}
									>
										<Skeleton className="size-8 rounded-full" />
										<div className="flex-1 space-y-1.5">
											<Skeleton className="h-4 w-20" />
											<Skeleton className="h-3 w-full" />
										</div>
									</div>
								))}
							</div>
							<div className="space-y-2">
								<Skeleton className="h-9 w-full" />
								<Skeleton className="h-9 w-full" />
							</div>
						</div>
					</aside>
				</div>
			</div>
		</output>
	);
}

function FieldSkeleton({ multiline = false }: { multiline?: boolean }) {
	return (
		<div className="space-y-2">
			<Skeleton className="h-4 w-24" />
			<Skeleton className={multiline ? "h-16 w-full" : "h-9 w-full"} />
		</div>
	);
}
