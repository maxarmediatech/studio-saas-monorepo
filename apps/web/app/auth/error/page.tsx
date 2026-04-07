import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { sanitizeRedirectPath } from "@shared/lib/sanitize-redirect-path";
import { AlertTriangleIcon } from "lucide-react";
import Link from "next/link";

type Props = {
	searchParams: Promise<{
		error?: string | string[];
		error_description?: string | string[];
		redirectTo?: string | string[];
	}>;
};

function getSingleValue(
	value: string | string[] | undefined,
): string | undefined {
	if (Array.isArray(value)) {
		return value[0];
	}

	return value;
}

export default async function AuthErrorPage({ searchParams }: Props) {
	const params = await searchParams;
	const error = getSingleValue(params.error);
	const errorDescription = getSingleValue(params.error_description);
	const redirectTo = getSingleValue(params.redirectTo);
	const safeRedirectPath = sanitizeRedirectPath(redirectTo, "/app");

	return (
		<AuthWrapper>
			<div className="mx-auto w-full max-w-md space-y-6">
				<Alert variant="destructive">
					<AlertTriangleIcon />
					<AlertTitle>Sign in interrupted</AlertTitle>
					<AlertDescription>
						{errorDescription ??
							"We couldn't complete sign in. Please try again."}
					</AlertDescription>
				</Alert>

				{error && (
					<p className="text-foreground/60 text-xs">
						Error code: {error}
					</p>
				)}

				<div className="flex gap-3">
					<Button asChild className="flex-1">
						<Link
							href={`/auth/login?redirectTo=${encodeURIComponent(safeRedirectPath)}`}
						>
							Try again
						</Link>
					</Button>
					<Button asChild variant="outline" className="flex-1">
						<Link href="/auth/signup">Create account</Link>
					</Button>
				</div>
			</div>
		</AuthWrapper>
	);
}
