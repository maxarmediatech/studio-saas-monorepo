type PhoneValidationResult =
	| { valid: true; normalized: string }
	| { valid: false; error: string };

export function normalizeAndValidateIndianPhone(
	phone: string,
): PhoneValidationResult {
	const stripped = phone.replace(/[\s\-()]/g, "");

	if (!stripped || stripped.trim() === "") {
		return { valid: false, error: "Phone number is invalid: empty" };
	}

	let digitsOnly = stripped.replace(/^\+/, "");

	if (!/^\d+$/.test(digitsOnly)) {
		return {
			valid: false,
			error: "Phone number is invalid: contains non-digit characters",
		};
	}

	if (digitsOnly.startsWith("0091")) {
		digitsOnly = `91${digitsOnly.slice(4)}`;
	} else if (digitsOnly.startsWith("091")) {
		digitsOnly = `91${digitsOnly.slice(3)}`;
	} else if (digitsOnly.startsWith("0") && digitsOnly.length === 11) {
		digitsOnly = `91${digitsOnly.slice(1)}`;
	} else if (digitsOnly.length === 10) {
		digitsOnly = `91${digitsOnly}`;
	}

	const indianMobilePattern = /^91[6-9]\d{9}$/;
	if (!indianMobilePattern.test(digitsOnly)) {
		return {
			valid: false,
			error: "Phone number is invalid: must be a valid Indian mobile number",
		};
	}

	return { valid: true, normalized: digitsOnly };
}
