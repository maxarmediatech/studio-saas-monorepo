"use client";

import { use, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import { PageHeader } from "@saas/studio";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

type Props = {
	params: Promise<{ organizationSlug: string }>;
	children: ReactNode;
};

export default function BookingsLayout({ params, children }: Props) {
	const { organizationSlug } = use(params);
	const pathname = usePathname();
	const isNewBooking = pathname.includes("/bookings/new");

	return (
		<div className="flex flex-col flex-1">
			<PageHeader
				key="header"
				title={isNewBooking ? "New Booking" : "Bookings"}
				backButton={
					isNewBooking ? (
						<Button variant="ghost" size="icon" asChild>
							<Link href={`/app/${organizationSlug}/bookings`}>
								<ArrowLeftIcon className="h-4 w-4" />
							</Link>
						</Button>
					) : undefined
				}
				actions={
					!isNewBooking ? (
						<Button asChild size="sm">
							<Link href={`/app/${organizationSlug}/bookings/new`}>
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
