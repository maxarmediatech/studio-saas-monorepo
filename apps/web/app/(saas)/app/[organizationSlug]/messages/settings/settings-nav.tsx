"use client";

import { cn } from "@repo/ui/lib/utils";
import { PageWidthWrapper } from "@saas/studio/components/PageWidthWrapper";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const tabs = [
	{ value: "whatsapp", label: "WhatsApp Config" },
	{ value: "templates", label: "Templates" },
	{ value: "tags", label: "Tags" },
] as const;

export function MessageSettingsNav({
	organizationSlug,
}: {
	organizationSlug: string;
}) {
	const searchParams = useSearchParams();
	const activeTab = searchParams.get("tab") ?? "whatsapp";
	const basePath = `/app/${organizationSlug}/messages/settings`;

	return (
		<div className="shrink-0">
			<div className="border-b border-neutral-200">
				<PageWidthWrapper>
					<div className="flex h-12 items-center sm:h-16">
						<h1 className="text-lg font-semibold text-neutral-900">
							Settings
						</h1>
					</div>
				</PageWidthWrapper>
			</div>

			<div className="border-b border-neutral-200">
				<PageWidthWrapper>
					<div className="-mb-px flex gap-6 overflow-x-auto">
						{tabs.map((tab) => {
							const isActive = tab.value === activeTab;
							const href =
								tab.value === "whatsapp"
									? basePath
									: `${basePath}?tab=${tab.value}`;

							return (
								<Link
									key={tab.value}
									href={href}
									className={cn(
										"relative shrink-0 py-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
										isActive && "text-foreground",
									)}
								>
									{tab.label}
									{isActive ? (
										<div className="absolute inset-x-0 bottom-0 h-0.5 bg-neutral-900" />
									) : null}
								</Link>
							);
						})}
					</div>
				</PageWidthWrapper>
			</div>
		</div>
	);
}
