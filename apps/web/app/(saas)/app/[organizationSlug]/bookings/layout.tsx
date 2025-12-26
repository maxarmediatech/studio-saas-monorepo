"use client";

import { Button } from "@repo/ui/components/button";
import { PageHeader } from "@saas/studio";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, use } from "react";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function BookingsLayout({ params, children }: Props) {
	const { organizationSlug } = use(params);
	const pathname = usePathname();
	const baseRoute = `/app/${organizationSlug}/bookings`;
	const isAtRoot = pathname === baseRoute;

	return (
		<div className="flex flex-col flex-1">
			<PageHeader
				key="header"
				title={isAtRoot ? "Bookings" : "New Booking"}
				actions={
					isAtRoot ? (
						<Button asChild size="sm">
							<Link href={`${baseRoute}/new/details`}>
								<PlusIcon className="mr-2 h-4 w-4" />
								New Booking
							</Link>
						</Button>
					) : undefined
				}
			/>
			<div key="content" className="flex-1">
				{children}
			</div>
		</div>
	);
}
