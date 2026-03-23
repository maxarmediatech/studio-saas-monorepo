"use client";

import { Button } from "@repo/ui/components/button";
import { PageContent } from "@saas/studio";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
	organizationSlug: string;
	children: ReactNode;
};

export function BookingsLayoutClient({ organizationSlug, children }: Props) {
	const pathname = usePathname();
	const baseRoute = `/app/${organizationSlug}/bookings`;
	const isNewBookingForm = pathname.startsWith(`${baseRoute}/new`);
	const isDetailPage =
		pathname !== baseRoute &&
		!isNewBookingForm &&
		pathname.startsWith(`${baseRoute}/`);

	if (isNewBookingForm || isDetailPage) {
		return <>{children}</>;
	}

	return (
		<PageContent
			title="Bookings"
			controls={
				<Button asChild size="sm" className="hidden md:inline-flex">
					<Link href={`${baseRoute}/new/details`}>
						<PlusIcon className="mr-2 h-4 w-4" />
						New Booking
					</Link>
				</Button>
			}
		>
			{children}
		</PageContent>
	);
}
