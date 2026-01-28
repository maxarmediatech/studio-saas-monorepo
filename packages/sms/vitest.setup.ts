import { beforeEach, vi } from "vitest";

// Default mock fetch that returns success
// Individual tests can override with their own mocks
beforeEach(() => {
	global.fetch = vi.fn(() =>
		Promise.resolve(
			new Response(
				JSON.stringify({
					type: "success",
					message: "OK",
					request_id: "mock-request-id-123",
				}),
				{ status: 200 },
			),
		),
	);
});
