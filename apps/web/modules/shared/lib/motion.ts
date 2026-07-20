const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function getPreferredScrollBehavior(
	prefersReducedMotion = typeof window !== "undefined" &&
		window.matchMedia(REDUCED_MOTION_QUERY).matches,
): ScrollBehavior {
	return prefersReducedMotion ? "auto" : "smooth";
}
