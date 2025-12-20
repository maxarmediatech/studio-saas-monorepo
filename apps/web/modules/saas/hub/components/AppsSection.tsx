"use client";

import { useTranslations } from "next-intl";
import { APPS } from "../lib/constants";

export function AppsSection() {
	const t = useTranslations();

	return (
		<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
			{APPS.map((app) => {
				const Icon = app.icon;
				const isComingSoon = app.status === "coming_soon";

				return (
					<div
						key={app.id}
						className={`group relative flex items-center gap-3 rounded-xl border bg-card p-4 transition-all duration-200 ${
							isComingSoon
								? "cursor-not-allowed opacity-50"
								: "cursor-pointer hover:border-foreground/20 hover:bg-accent/50 hover:shadow-md hover:shadow-black/5"
						}`}
					>
						{/* Icon */}
						<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/10">
							<Icon className="size-5 text-primary" />
						</div>

						{/* Content */}
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<h3 className="truncate font-medium text-sm">
									{app.name}
								</h3>
								{isComingSoon && (
									<span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wide">
										Soon
									</span>
								)}
							</div>
							<p className="mt-0.5 line-clamp-1 text-muted-foreground text-xs">
								{app.description}
							</p>
						</div>
					</div>
				);
			})}
		</div>
	);
}
