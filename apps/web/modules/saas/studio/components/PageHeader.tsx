"use client";

import { Button } from "@repo/ui/components/button";
import { Separator } from "@repo/ui/components/separator";
import { SidebarTrigger } from "@repo/ui/components/sidebar";
import { cn } from "@repo/ui/lib/utils";
import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

interface PageHeaderProps {
	title: string;
	description?: string;
	actions?: ReactNode;
	className?: string;
}

export function PageHeader({
	title,
	description,
	actions,
	className,
}: PageHeaderProps) {
	const router = useRouter();

	return (
		<header
			className={cn(
				"sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background -mx-6 -mt-6 lg:-mx-8 lg:-mt-8 px-4 mb-6",
				className,
			)}
		>
			<div className="flex flex-1 items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<div className="flex items-center md:hidden">
						<SidebarTrigger />
						<Separator
							orientation="vertical"
							className="ml-2 mr-2 data-[orientation=vertical]:h-4"
						/>
					</div>

					<Button
						variant="ghost"
						size="icon"
						onClick={() => router.back()}
					>
						<ArrowLeftIcon className="h-4 w-4" />
					</Button>

					<div>
						<h1 className="font-semibold text-base text-foreground">
							{title}
						</h1>
						{description && (
							<p className="text-sm text-muted-foreground hidden sm:block">
								{description}
							</p>
						)}
					</div>
				</div>
				{actions && <div className="flex items-center gap-2">{actions}</div>}
			</div>
		</header>
	);
}
