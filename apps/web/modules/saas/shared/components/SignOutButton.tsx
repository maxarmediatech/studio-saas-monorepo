"use client";

import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import { Button } from "@repo/ui/components/button";

type Props = {
	variant?: React.ComponentProps<typeof Button>["variant"];
	size?: React.ComponentProps<typeof Button>["size"];
	className?: string;
};

export function SignOutButton({
	variant = "outline",
	size = "sm",
	className,
}: Props) {
	const onLogout = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: async () => {
					window.location.href = new URL(
						config.auth.redirectAfterLogout,
						window.location.origin,
					).toString();
				},
			},
		});
	};

	return (
		<Button
			variant={variant}
			size={size}
			className={className}
			onClick={onLogout}
		>
			Sign out
		</Button>
	);
}
