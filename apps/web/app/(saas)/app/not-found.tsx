import { Button } from "@repo/ui/components/button";
import Link from "next/link";

export default function NotFoundPage() {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
			<h1 className="text-4xl font-bold">404</h1>
			<p className="text-muted-foreground">
				The page you're looking for doesn't exist.
			</p>
			<Button asChild>
				<Link href="/">Go back home</Link>
			</Button>
		</div>
	);
}
