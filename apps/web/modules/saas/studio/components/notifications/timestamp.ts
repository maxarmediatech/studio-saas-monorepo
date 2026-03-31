export function formatNotificationTimestamp(value: string) {
	const date = new Date(value);
	return date.toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}
