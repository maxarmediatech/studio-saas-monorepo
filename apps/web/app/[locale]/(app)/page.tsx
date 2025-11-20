import { Button } from "@repo/ui/components/button";

export default function LocaleHomePage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-4 p-10">
			<h1 className="text-2xl font-bold">HOme</h1>
			<Button variant="default">Click me</Button>
			<Button variant="destructive">Destructive</Button>
			<Button variant="outline">Outline</Button>
		</div>
	);
}
