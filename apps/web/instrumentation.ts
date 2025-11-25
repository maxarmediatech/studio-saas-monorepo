export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("./modules/shared/lib/orpc-client.server");
	}
}
