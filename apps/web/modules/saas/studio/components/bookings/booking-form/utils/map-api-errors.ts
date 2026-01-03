/**
 * API Error Mapping Utilities
 *
 * Maps ORPC API errors to react-hook-form field errors.
 * Parses error messages to extract field-specific context and sets
 * appropriate form errors for user feedback.
 */

import type { FieldPath, UseFormSetError } from "react-hook-form";
import type { BookingFormValues, BookingTab } from "../booking-form-schema";

/**
 * Error patterns that can be mapped to specific form fields
 */
const ERROR_PATTERNS = {
	// Client not found errors -> participants field
	clientNotFound: /Client\(s\) not found: (.+)/i,
	// Crew not found errors -> shoots/deliverables crew assignments
	crewNotFound: /Crew member\(s\) not found: (.+)/i,
	// Validation errors from Zod (if passed through)
	validationError: /Validation error: (.+)/i,
} as const;

/**
 * Mapping of error patterns to form field paths and which step they belong to
 */
interface ErrorMapping {
	field: FieldPath<BookingFormValues>;
	step: BookingTab;
	messageTemplate: (ids: string) => string;
}

const ERROR_FIELD_MAPPINGS: Record<keyof typeof ERROR_PATTERNS, ErrorMapping> =
	{
		clientNotFound: {
			field: "participants",
			step: "details",
			messageTemplate: (ids) =>
				`One or more selected clients no longer exist: ${ids}. Please remove them and select valid clients.`,
		},
		crewNotFound: {
			field: "shoots", // Could also be deliverables, but we'll set a root error for crew
			step: "shoots",
			messageTemplate: (ids) =>
				`One or more selected crew members no longer exist: ${ids}. Please update crew assignments.`,
		},
		validationError: {
			field: "root" as FieldPath<BookingFormValues>, // Generic root error
			step: "review",
			messageTemplate: (msg) => msg,
		},
	};

/**
 * Result of mapping an API error
 */
export interface MappedError {
	field: FieldPath<BookingFormValues> | "root";
	step: BookingTab | null;
	message: string;
}

/**
 * Parse an API error and extract field-specific information
 */
export function parseApiError(error: unknown): MappedError | null {
	// Extract error message from various error shapes
	const message = extractErrorMessage(error);
	if (!message) {
		return null;
	}

	// Try to match known error patterns
	for (const [patternKey, pattern] of Object.entries(ERROR_PATTERNS)) {
		const match = message.match(pattern);
		if (match) {
			const mapping =
				ERROR_FIELD_MAPPINGS[patternKey as keyof typeof ERROR_PATTERNS];
			const extractedValue = match[1] || "";
			return {
				field: mapping.field,
				step: mapping.step,
				message: mapping.messageTemplate(extractedValue),
			};
		}
	}

	// Return as root error if no pattern matched
	return {
		field: "root",
		step: null,
		message: message,
	};
}

/**
 * Extract error message from various error shapes (Error, ORPCError, object, string)
 */
function extractErrorMessage(error: unknown): string | null {
	if (!error) {
		return null;
	}

	// String error
	if (typeof error === "string") {
		return error;
	}

	// Error object with message
	if (error instanceof Error) {
		return error.message;
	}

	// ORPC error shape: { code: string, message: string, data?: unknown }
	if (typeof error === "object" && "message" in error) {
		const msg = (error as { message: unknown }).message;
		if (typeof msg === "string") {
			return msg;
		}
	}

	// Fallback
	return null;
}

/**
 * Map API error to form errors and return the step that contains the error
 *
 * @param error - The API error to map
 * @param setError - React Hook Form's setError function
 * @returns The step that contains the error, or null if it's a root error
 */
export function mapApiErrorToForm(
	error: unknown,
	setError: UseFormSetError<BookingFormValues>,
): BookingTab | null {
	const mapped = parseApiError(error);

	if (!mapped) {
		// Fallback for unknown errors
		setError("root", {
			message: "An unexpected error occurred. Please try again.",
		});
		return null;
	}

	if (mapped.field === "root") {
		setError("root", { message: mapped.message });
		return mapped.step;
	}

	// Set field-specific error
	setError(mapped.field, { message: mapped.message });
	return mapped.step;
}

/**
 * Clear API-related errors from the form
 * Call this before making a new API request to reset previous API errors
 */
export function clearApiErrors(
	clearErrors: (name?: FieldPath<BookingFormValues> | "root") => void,
): void {
	clearErrors("root");
	// Could also clear specific field errors if needed
	clearErrors("participants");
	clearErrors("shoots");
	clearErrors("deliverables");
}
