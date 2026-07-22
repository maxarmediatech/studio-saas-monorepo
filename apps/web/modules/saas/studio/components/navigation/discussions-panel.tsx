"use client";

import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { discussionsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Hash, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { NavAreaConfig } from "../../lib/navigation/types";
import { ChannelCreateDialog } from "../discussions/channel-create-dialog";

interface DiscussionsPanelProps {
	area: NavAreaConfig;
	studioSlug: string;
}

export function DiscussionsPanel({ area, studioSlug }: DiscussionsPanelProps) {
	const pathname = usePathname();
	const [createDialogOpen, setCreateDialogOpen] = useState(false);

	const { data, isLoading } = useQuery(
		discussionsApi.listChannelsOptions(studioSlug),
	);
	const channels = data?.data ?? [];

	const getChannelPath = (slug: string) =>
		`/app/${studioSlug}/discussions/${slug}`;

	const isChannelActive = (slug: string) => {
		const channelPath = getChannelPath(slug);
		return (
			pathname === channelPath || pathname.startsWith(`${channelPath}/`)
		);
	};

	return (
		<div className="scrollbar-hide relative flex h-full w-[var(--sidebar-panel-width)] flex-col overflow-y-auto overflow-x-hidden rounded-l-xl bg-neutral-100">
			<div className="p-3">
				{area.backHref ? (
					<Link
						href={area.backHref}
						className="group flex items-center gap-3 px-3 py-2"
					>
						<div
							className={cn(
								"flex size-6 items-center justify-center rounded-lg bg-neutral-200 text-neutral-600",
								"transition-[transform,background-color,color] duration-150 group-hover:-translate-x-0.5 group-hover:bg-neutral-300",
							)}
						>
							<ChevronLeft className="size-3" strokeWidth={2.5} />
						</div>
						<span className="text-lg font-semibold text-neutral-900">
							{area.title}
						</span>
					</Link>
				) : (
					<div className="flex items-center gap-3 px-3 py-2">
						<span className="text-lg font-semibold text-neutral-900">
							{area.title}
						</span>
					</div>
				)}
			</div>

			<div className="px-3 pb-3">
				<Button
					variant="outline"
					size="sm"
					className="w-full justify-start gap-2"
					onClick={() => setCreateDialogOpen(true)}
				>
					<Plus className="size-4" />
					Create Channel
				</Button>
			</div>

			<div className="flex flex-col gap-0.5 px-3 pb-3">
				{isLoading ? (
					<>
						<Skeleton className="h-8 w-full rounded-lg" />
						<Skeleton className="h-8 w-full rounded-lg" />
						<Skeleton className="h-8 w-full rounded-lg" />
					</>
				) : channels.length === 0 ? (
					<div className="px-3 py-6 text-center text-sm text-neutral-500">
						No channels yet
					</div>
				) : (
					channels.map((channel) => {
						const isActive = isChannelActive(channel.slug);
						return (
							<Link
								key={channel.id}
								href={getChannelPath(channel.slug)}
								className={cn(
									"group flex h-8 items-center gap-2.5 rounded-lg px-2 text-sm leading-none transition-[background-color,color,font-weight] duration-75",
									isActive
										? "bg-blue-100/50 font-medium text-blue-600 hover:bg-blue-100/80 active:bg-blue-100"
										: "text-neutral-700 hover:bg-black/5 active:bg-black/10",
								)}
							>
								<Hash
									className={cn(
										"size-4 shrink-0",
										isActive
											? "text-blue-600"
											: "text-neutral-500",
									)}
								/>
								<span className="truncate">{channel.name}</span>
							</Link>
						);
					})
				)}
			</div>

			<ChannelCreateDialog
				organizationSlug={studioSlug}
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
			/>
		</div>
	);
}
