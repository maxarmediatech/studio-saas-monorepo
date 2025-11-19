import { Button } from "@repo/ui/components/button";

export default function DashboardPage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 p-10">
			<h1 className="text-3xl font-bold">Dashboard</h1>
			<p className="text-muted-foreground">
				Welcome to your protected dashboard!
			</p>
			<div className="flex gap-2">
				<Button variant="default">Primary Action</Button>
				<Button variant="outline">Secondary Action</Button>
			</div>
		</div>
	);
}
