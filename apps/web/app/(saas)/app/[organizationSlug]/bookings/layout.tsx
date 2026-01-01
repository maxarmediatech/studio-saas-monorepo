"use client";

import { Button } from "@repo/ui/components/button";
import { PageContent } from "@saas/studio";
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
	const isNewBookingForm = pathname.startsWith(`${baseRoute}/new`);

	// New booking form uses its own full-bleed layout
	if (isNewBookingForm) {
		return <>{children}</>;
	}

	return (
		<PageContent
			title="Bookings"
			controls={
				<Button asChild size="sm">
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
