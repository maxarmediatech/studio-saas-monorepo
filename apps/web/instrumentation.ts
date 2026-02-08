export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		const { assertCoreEnv } = await import("@repo/env");
		assertCoreEnv();
		await import("./modules/shared/lib/orpc-client.server");
	}
}
