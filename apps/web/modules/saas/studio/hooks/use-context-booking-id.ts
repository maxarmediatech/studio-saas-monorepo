"use client";

import { useParams } from "next/navigation";
import { useBookingParams } from "./params/use-booking-params";

/**
 * Resolves bookingId from route params (authoritative) or search params (fallback).
 *
 * - Route params: when on a booking detail PAGE (/bookings/[bookingId]) — takes priority
 * - Search params: when opened from a booking detail SHEET (?bookingId=abc) — fallback
 *
 * Route-first ensures the page the user is viewing wins over potentially stale query params.
 */
export function useContextBookingId(): string | undefined {
	const { bookingId: queryBookingId } = useBookingParams();
	const routeParams = useParams<{ bookingId?: string }>();
	return routeParams?.bookingId ?? queryBookingId ?? undefined;
}
