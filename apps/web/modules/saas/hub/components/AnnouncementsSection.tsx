"use client";

import { SparklesIcon, WrenchIcon, ZapIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ANNOUNCEMENTS } from "../lib/constants";
import type { AnnouncementType } from "../lib/types";

const typeConfig: Record<
	AnnouncementType,
	{
		icon: React.ElementType;
		color: string;
		bg: string;
	}
> = {
	feature: {
		icon: SparklesIcon,
		color: "text-violet-600 dark:text-violet-400",
		bg: "bg-violet-100 dark:bg-violet-500/20",
	},
	update: {
		icon: ZapIcon,
		color: "text-blue-600 dark:text-blue-400",
		bg: "bg-blue-100 dark:bg-blue-500/20",
	},
	fix: {
		icon: WrenchIcon,
		color: "text-amber-600 dark:text-amber-400",
		bg: "bg-amber-100 dark:bg-amber-500/20",
	},
};

export function AnnouncementsSection() {
	const t = useTranslations();
	const locale = useLocale();

	return (
		<div className="divide-y rounded-xl border bg-card">
			{ANNOUNCEMENTS.map((announcement, index) => {
				const config = typeConfig[announcement.type];
				const Icon = config.icon;
				const isFirst = index === 0;

				return (
					<article
						key={announcement.id}
						className="group relative px-4 py-4 transition-colors hover:bg-accent/50"
					>
						<div className="flex gap-3">
							{/* Icon */}
							<div
								className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md ${config.bg}`}
							>
								<Icon className={`size-3.5 ${config.color}`} />
							</div>

							{/* Content */}
							<div className="min-w-0 flex-1">
								<div className="flex items-start justify-between gap-2">
									<h3
										className={`font-medium text-sm leading-tight ${isFirst ? "" : "text-muted-foreground"}`}
									>
										{announcement.title}
									</h3>
									<time className="shrink-0 text-muted-foreground/60 text-xs tabular-nums">
										{formatRelativeDate(announcement.date, t, locale)}
									</time>
								</div>
								<p className="mt-1 line-clamp-2 text-muted-foreground text-xs leading-relaxed">
									{announcement.description}
								</p>
							</div>
						</div>
					</article>
				);
			})}
		</div>
	);
}

type Translator = (
	key: string,
	values?: Record<string, string | number | Date>,
) => string;

function formatRelativeDate(
	dateString: string,
	t: Translator,
	locale: string,
): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffInDays = Math.floor(
		(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
	);

	if (diffInDays < 0) {
		return date.toLocaleDateString(locale, {
			month: "short",
			day: "numeric",
		});
	}
	if (diffInDays === 0) return t("hub.announcements.relativeDate.today");
	if (diffInDays === 1) return t("hub.announcements.relativeDate.yesterday");
	if (diffInDays < 7) {
		return t("hub.announcements.relativeDate.daysAgo", {
			count: diffInDays,
		});
	}
	if (diffInDays < 30) {
		return t("hub.announcements.relativeDate.weeksAgo", {
			count: Math.floor(diffInDays / 7),
		});
	}

	return date.toLocaleDateString(locale, {
		month: "short",
		day: "numeric",
	});
}
