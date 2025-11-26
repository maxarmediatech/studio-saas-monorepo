import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";

export function Footer() {
	return (
		<footer
			className={cn(
				"container max-w-6xl py-6 text-center text-foreground/60 text-xs",
			)}
		>
			<Link href="/legal/privacy-policy">Privacy policy</Link>
			<span className="opacity-50"> | </span>
			<Link href="/legal/terms">Terms and conditions</Link>
		</footer>
	);
}
