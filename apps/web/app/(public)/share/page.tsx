import { Button } from "@repo/ui/components/button";

export default function PublicSharePage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 p-10">
			<h1 className="text-3xl font-bold">Public Share</h1>
			<p className="text-muted-foreground">
				This is publicly accessible content on studio-name.example.com
			</p>
			<p className="text-sm text-muted-foreground">
				No authentication required
			</p>
			<Button variant="outline">View Content</Button>
		</div>
	);
}
