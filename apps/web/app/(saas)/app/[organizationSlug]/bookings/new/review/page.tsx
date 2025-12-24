"use client";

import {
	BookingReviewStep,
	type BookingTab,
} from "@saas/studio/components/bookings";
import { useParams, useRouter } from "next/navigation";

export default function ReviewPage() {
	const router = useRouter();
	const params = useParams<{ organizationSlug: string }>();

	const handleNavigateToStep = (step: BookingTab) => {
		router.push(`/app/${params.organizationSlug}/bookings/new/${step}`);
	};

	return <BookingReviewStep onNavigateToStep={handleNavigateToStep} />;
}
