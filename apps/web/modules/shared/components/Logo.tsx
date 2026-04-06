import { config } from "@repo/config";
import { cn } from "@repo/ui/lib/utils";
import Image from "next/image";

const LOGO_MARK_SRC = "/images/brand/stuwiz-mark-tight.png";
const LOGO_LOCKUP_DARK_SRC = "/images/brand/stuwiz-logo-dark.png";

function LogoMark({ className }: { className?: string }) {
	return (
		<span
			className={cn("relative block h-8 w-[3.5rem] shrink-0", className)}
		>
			<Image
				alt={`${config.appName} logo`}
				className="object-contain"
				fill
				sizes="56px"
				src={LOGO_MARK_SRC}
			/>
		</span>
	);
}

function LogoBadge({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"inline-flex h-9 w-[3.15rem] shrink-0 items-center justify-center",
				className,
			)}
		>
			<span className="relative block h-[1.6rem] w-[3.05rem]">
				<Image
					alt={`${config.appName} logo`}
					className="object-contain"
					fill
					sizes="52px"
					src={LOGO_MARK_SRC}
				/>
			</span>
		</span>
	);
}

function LogoLockup({ className }: { className?: string }) {
	return (
		<span
			className={cn("relative block h-10 w-[10rem] shrink-0", className)}
		>
			<Image
				alt={`${config.appName} logo`}
				className="object-contain"
				fill
				loading="eager"
				sizes="160px"
				src={LOGO_LOCKUP_DARK_SRC}
			/>
		</span>
	);
}

type LogoVariant = "badge" | "lockup" | "mark";

export function Logo({
	withLabel = true,
	variant,
	className,
}: {
	className?: string;
	withLabel?: boolean;
	variant?: LogoVariant;
}) {
	const resolvedVariant = variant ?? (withLabel ? "lockup" : "mark");

	if (resolvedVariant === "badge") {
		return <LogoBadge className={className} />;
	}

	if (resolvedVariant === "mark") {
		return <LogoMark className={className} />;
	}

	return <LogoLockup className={className} />;
}
