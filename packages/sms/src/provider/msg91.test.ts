import { beforeEach, describe, expect, it, vi } from "vitest";
import { Msg91Provider } from "./msg91";

describe("Msg91Provider", () => {
	let provider: Msg91Provider;

	beforeEach(() => {
		provider = new Msg91Provider({
			authKey: "test-auth-key",
			senderId: "TEST",
		});
		vi.clearAllMocks();
	});

	describe("Phone Normalization", () => {
		describe("Valid Indian phone numbers", () => {
			it("should normalize 10-digit number (9876543210)", async () => {
				const result = await provider.send({
					to: "9876543210",
					message: "Test",
					templateId: "test-flow",
				});

				// Should succeed with normalized number
				expect(result.success).toBe(true);
				expect(result.messageId).toBeDefined();
			});

			it("should normalize +91 prefixed number (+919876543210)", async () => {
				const result = await provider.send({
					to: "+919876543210",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(true);
				expect(result.messageId).toBeDefined();
			});

			it("should normalize space-separated number (91 9876543210)", async () => {
				const result = await provider.send({
					to: "91 9876543210",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(true);
				expect(result.messageId).toBeDefined();
			});

			it("should normalize 0-prefixed number (0919876543210)", async () => {
				const result = await provider.send({
					to: "0919876543210",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(true);
				expect(result.messageId).toBeDefined();
			});

			it("should normalize 0091-prefixed number (00919876543210)", async () => {
				const result = await provider.send({
					to: "00919876543210",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(true);
				expect(result.messageId).toBeDefined();
			});

			it("should normalize number with hyphens (98-765-43210)", async () => {
				const result = await provider.send({
					to: "98-765-43210",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(true);
				expect(result.messageId).toBeDefined();
			});

			it("should normalize number with parentheses ((98) 7654-3210)", async () => {
				const result = await provider.send({
					to: "(98) 7654-3210",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(true);
				expect(result.messageId).toBeDefined();
			});

			it("should normalize number with mixed formatting (+91 98-765-43210)", async () => {
				const result = await provider.send({
					to: "+91 98-765-43210",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(true);
				expect(result.messageId).toBeDefined();
			});

			it("should normalize number starting with 6 (6876543210)", async () => {
				const result = await provider.send({
					to: "6876543210",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(true);
				expect(result.messageId).toBeDefined();
			});

			it("should normalize number starting with 7 (7876543210)", async () => {
				const result = await provider.send({
					to: "7876543210",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(true);
				expect(result.messageId).toBeDefined();
			});

			it("should normalize number starting with 8 (8876543210)", async () => {
				const result = await provider.send({
					to: "8876543210",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(true);
				expect(result.messageId).toBeDefined();
			});

			it("should normalize number starting with 9 (9876543210)", async () => {
				const result = await provider.send({
					to: "9876543210",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(true);
				expect(result.messageId).toBeDefined();
			});
		});

		describe("Invalid phone numbers", () => {
			it("should reject empty string", async () => {
				const result = await provider.send({
					to: "",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(false);
				expect(result.error).toBeDefined();
				expect(result.error).toContain("invalid");
			});

			it("should reject whitespace-only string", async () => {
				const result = await provider.send({
					to: "   ",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(false);
				expect(result.error).toBeDefined();
				expect(result.error).toContain("invalid");
			});

			it("should reject number with non-digit characters", async () => {
				const result = await provider.send({
					to: "9876543210abc",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(false);
				expect(result.error).toBeDefined();
				expect(result.error).toContain("invalid");
			});

			it("should reject non-Indian number (US format)", async () => {
				const result = await provider.send({
					to: "1234567890",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(false);
				expect(result.error).toBeDefined();
				expect(result.error).toContain("invalid");
			});

			it("should reject too-short number (5 digits)", async () => {
				const result = await provider.send({
					to: "98765",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(false);
				expect(result.error).toBeDefined();
				expect(result.error).toContain("invalid");
			});

			it("should reject too-long number (15 digits)", async () => {
				const result = await provider.send({
					to: "919876543210123",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(false);
				expect(result.error).toBeDefined();
				expect(result.error).toContain("invalid");
			});

			it("should reject number starting with 0-5 (non-mobile)", async () => {
				const result = await provider.send({
					to: "0176543210",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(false);
				expect(result.error).toBeDefined();
				expect(result.error).toContain("invalid");
			});

			it("should reject number starting with 5 (non-mobile)", async () => {
				const result = await provider.send({
					to: "5876543210",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(false);
				expect(result.error).toBeDefined();
				expect(result.error).toContain("invalid");
			});

			it("should reject number with special characters", async () => {
				const result = await provider.send({
					to: "98@765#3210",
					message: "Test",
					templateId: "test-flow",
				});

				expect(result.success).toBe(false);
				expect(result.error).toBeDefined();
				expect(result.error).toContain("invalid");
			});
		});
	});

	describe("Request Timeout", () => {
		it("should timeout if request takes longer than 15 seconds", async () => {
			// Mock fetch to simulate slow network
				const slowFetch = vi.fn(
					() =>
						new Promise<Response>((resolve) => {
							setTimeout(() => {
								resolve(
									new Response(
									JSON.stringify({
										type: "success",
										message: "OK",
										request_id: "123",
									}),
									{ status: 200 },
								),
							);
						}, 16000); // 16 seconds
					}),
			);

			global.fetch = slowFetch;

			const result = await provider.send({
				to: "9876543210",
				message: "Test",
				templateId: "test-flow",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error).toContain("timeout");
		});

		it("should succeed if request completes within 15 seconds", async () => {
				const fastFetch = vi.fn(
					() =>
						new Promise<Response>((resolve) => {
							setTimeout(() => {
								resolve(
									new Response(
									JSON.stringify({
										type: "success",
										message: "OK",
										request_id: "123",
									}),
									{ status: 200 },
								),
							);
						}, 5000); // 5 seconds
					}),
			);

			global.fetch = fastFetch;

			const result = await provider.send({
				to: "9876543210",
				message: "Test",
				templateId: "test-flow",
			});

			expect(result.success).toBe(true);
			expect(result.messageId).toBe("123");
		});
	});

	describe("Error Classification", () => {
		it("should classify 429 (rate limit) as retryable", async () => {
			const rateLimitFetch = vi.fn(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							type: "error",
							message: "Rate limit exceeded",
						}),
						{ status: 429 },
					),
				),
			);

			global.fetch = rateLimitFetch;

			const result = await provider.send({
				to: "9876543210",
				message: "Test",
				templateId: "test-flow",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			// Should indicate this is retryable
			expect(result.error).toContain("429");
		});

		it("should classify 5xx errors as retryable", async () => {
			const serverErrorFetch = vi.fn(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							type: "error",
							message: "Internal server error",
						}),
						{ status: 500 },
					),
				),
			);

			global.fetch = serverErrorFetch;

			const result = await provider.send({
				to: "9876543210",
				message: "Test",
				templateId: "test-flow",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			// Should indicate this is retryable
			expect(result.error).toContain("500");
		});

		it("should classify 503 (service unavailable) as retryable", async () => {
			const unavailableFetch = vi.fn(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							type: "error",
							message: "Service unavailable",
						}),
						{ status: 503 },
					),
				),
			);

			global.fetch = unavailableFetch;

			const result = await provider.send({
				to: "9876543210",
				message: "Test",
				templateId: "test-flow",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error).toContain("503");
		});

		it("should classify 401 (unauthorized) as fatal", async () => {
			const unauthorizedFetch = vi.fn(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							type: "error",
							message: "Invalid auth key",
						}),
						{ status: 401 },
					),
				),
			);

			global.fetch = unauthorizedFetch;

			const result = await provider.send({
				to: "9876543210",
				message: "Test",
				templateId: "test-flow",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			// Should indicate this is NOT retryable
			expect(result.error).toContain("401");
		});

		it("should classify 403 (forbidden) as fatal", async () => {
			const forbiddenFetch = vi.fn(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							type: "error",
							message: "Forbidden",
						}),
						{ status: 403 },
					),
				),
			);

			global.fetch = forbiddenFetch;

			const result = await provider.send({
				to: "9876543210",
				message: "Test",
				templateId: "test-flow",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error).toContain("403");
		});

		it("should classify 400 (bad request) as fatal", async () => {
			const badRequestFetch = vi.fn(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							type: "error",
							message: "Invalid request",
						}),
						{ status: 400 },
					),
				),
			);

			global.fetch = badRequestFetch;

			const result = await provider.send({
				to: "9876543210",
				message: "Test",
				templateId: "test-flow",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error).toContain("400");
		});

		it("should classify 404 (not found) as fatal", async () => {
			const notFoundFetch = vi.fn(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							type: "error",
							message: "Not found",
						}),
						{ status: 404 },
					),
				),
			);

			global.fetch = notFoundFetch;

			const result = await provider.send({
				to: "9876543210",
				message: "Test",
				templateId: "test-flow",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error).toContain("404");
		});

		it("should handle network errors (connection refused)", async () => {
			const networkErrorFetch = vi.fn(() =>
				Promise.reject(new Error("ECONNREFUSED: Connection refused")),
			);

			global.fetch = networkErrorFetch;

			const result = await provider.send({
				to: "9876543210",
				message: "Test",
				templateId: "test-flow",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error).toContain("ECONNREFUSED");
		});

		it("should handle DNS resolution errors", async () => {
			const dnsErrorFetch = vi.fn(() =>
				Promise.reject(
					new Error("ENOTFOUND: getaddrinfo ENOTFOUND api.msg91.com"),
				),
			);

			global.fetch = dnsErrorFetch;

			const result = await provider.send({
				to: "9876543210",
				message: "Test",
				templateId: "test-flow",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(result.error).toContain("ENOTFOUND");
		});

		it("should handle non-JSON response bodies", async () => {
			const nonJsonFetch = vi.fn(() =>
				Promise.resolve(
					new Response("Internal Server Error", {
						status: 500,
						headers: { "Content-Type": "text/plain" },
					}),
				),
			);

			global.fetch = nonJsonFetch;

			const result = await provider.send({
				to: "9876543210",
				message: "Test",
				templateId: "test-flow",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			// Should include status code even without JSON body
			expect(result.error).toContain("500");
		});
	});

	describe("Missing Template ID", () => {
		it("should reject send without templateId", async () => {
			const result = await provider.send({
				to: "9876543210",
				message: "Test",
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain("template");
		});
	});
});
