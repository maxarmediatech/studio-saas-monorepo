"use client";

import { Button } from "@repo/ui/components/button";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { discussionsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Hash, Plus } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

export function ChannelsSidebar() {
	const params = useParams();
	const organizationSlug = params.organizationSlug as string;
	const pathname = usePathname();

	const { data, isLoading } = useQuery(discussionsApi.listChannelsOptions());
	const channels = (data as any)?.data ?? data ?? [];

	if (isLoading) {
		return (
			<div className="flex flex-col gap-4 p-4">
				<div className="flex items-center justify-between">
					<Skeleton className="h-5 w-24" />
				</div>
				<div className="flex flex-col gap-2">
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton key={i} className="h-8 w-full" />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col bg-neutral-50/50">
			<div className="flex h-12 shrink-0 items-center justify-between border-b px-4 sm:h-16">
				<h2 className="text-sm font-semibold text-neutral-900">
					Channels
				</h2>
			</div>

			<ScrollArea className="flex-1">
				<div className="p-2">
					<div className="flex flex-col gap-1">
						{Array.isArray(channels) &&
							channels.map((channel: any) => {
								const isActive = pathname.includes(
									`/discussions/${channel.slug}`,
								);

								return (
									<Link
										key={channel.id}
										href={`/app/${organizationSlug}/discussions/${channel.slug}`}
										className={cn(
											"group flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-100",
											isActive
												? "bg-neutral-200 text-neutral-900"
												: "text-neutral-600",
										)}
									>
										<div className="flex items-center gap-2 overflow-hidden">
											{channel.emoji ? (
												<span className="shrink-0">
													{channel.emoji}
												</span>
											) : (
												<Hash className="size-4 shrink-0 text-neutral-400" />
											)}
											<span className="truncate">
												{channel.name}
											</span>
										</div>
									</Link>
								);
							})}
					</div>
				</div>
			</ScrollArea>

			<div className="border-t p-2">
				<Button
					variant="ghost"
					className="w-full justify-start gap-2 text-neutral-500 hover:text-neutral-900"
					size="sm"
				>
					<Plus className="size-4" />
					<span>Create Channel</span>
				</Button>
			</div>
		</div>
	);
}
