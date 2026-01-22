"use client";

import type { EditorContentJson } from "@repo/editor";
import { ReadOnlyRenderer } from "@repo/editor";
import { Badge } from "@repo/ui/components/badge";
import { Skeleton } from "@repo/ui/components/skeleton";
import { checkinsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { HandIcon } from "lucide-react";
import Link from "next/link";

function isEditorContentJson(value: unknown): value is EditorContentJson {
	if (typeof value !== "object" || value === null) return false;
	const record = value as Record<string, unknown>;
	return record.type === "doc";
}

function formatCheckinDate(date: Date | string): string {
	const d = new Date(date);
	if (isToday(d)) return "Today";
	if (isYesterday(d)) return "Yesterday";
	return format(d, "MMM d");
}

interface CrewCheckinsSectionProps {
	/** The linked userId from crew record (crew.userId) - required for fetching checkins */
	userId: string | null;
	organizationSlug: string;
}

export function CrewCheckinsSection({
	userId,
	organizationSlug,
}: CrewCheckinsSectionProps) {
	const { data: checkinsData, isLoading } = useQuery({
		...checkinsApi.listUserCheckinsOptions({
			userId: userId ?? "",
			limit: 10,
		}),
		enabled: !!userId,
	});

	const checkins = checkinsData?.data ?? [];

	if (!userId) {
		return (
			<div className="mt-8 border-t pt-6">
				<h2 className="font-semibold flex items-center gap-2">
					<HandIcon className="size-4" />
					Recent Checkins
				</h2>
				<div className="mt-4 text-sm text-muted-foreground">
					This crew member doesn't have app access. Checkins are only
					available for crew linked to user accounts.
				</div>
			</div>
		);
	}

	return (
		<div className="mt-8 border-t pt-6">
			<h2 className="font-semibold flex items-center gap-2">
				<HandIcon className="size-4" />
				Recent Checkins ({checkins.length})
			</h2>

			{isLoading ? (
				<div className="mt-4 space-y-3">
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			) : checkins.length > 0 ? (
				<div className="mt-4 space-y-3">
					{checkins.map((checkin) => (
						<Link
							key={checkin.id}
							href={`/app/${organizationSlug}/checkins/${checkin.checkinType.id}`}
							className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
						>
							<span className="text-lg shrink-0">
								{checkin.checkinType.emoji ?? "👋"}
							</span>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<span className="font-medium text-sm">
										{checkin.checkinType.name}
									</span>
									<Badge
										variant="outline"
										className="text-xs"
									>
										{formatCheckinDate(checkin.checkinDate)}
									</Badge>
								</div>
								{isEditorContentJson(checkin.contentJson) ? (
									<ReadOnlyRenderer
										content={
											checkin.contentJson as EditorContentJson
										}
										className="mt-1 text-sm text-muted-foreground line-clamp-2"
									/>
								) : (
									<p className="mt-1 text-sm text-muted-foreground line-clamp-2">
										{checkin.contentText ?? checkin.content}
									</p>
								)}
								<div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
									{checkin.checkinType.team && (
										<span>
											{checkin.checkinType.team.name}
										</span>
									)}
									{checkin.commentCount > 0 && (
										<>
											<span>·</span>
											<span>
												{checkin.commentCount}{" "}
												{checkin.commentCount === 1
													? "comment"
													: "comments"}
											</span>
										</>
									)}
								</div>
							</div>
							<span className="text-xs text-muted-foreground shrink-0">
								{formatDistanceToNow(
									new Date(checkin.createdAt),
									{
										addSuffix: true,
									},
								)}
							</span>
						</Link>
					))}
				</div>
			) : (
				<div className="mt-4 text-sm text-muted-foreground">
					No checkins posted yet.
				</div>
			)}
		</div>
	);
}
