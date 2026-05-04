"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

type FacebookLoginResponse = {
	authResponse?: {
		code?: string;
	};
};

type FacebookSdk = {
	init: (params: {
		appId: string;
		autoLogAppEvents: boolean;
		xfbml: boolean;
		version: string;
	}) => void;
	login: (
		callback: (response: FacebookLoginResponse) => void,
		options: {
			config_id: string;
			response_type: "code";
			override_default_response_type: true;
			extras: { setup: Record<string, never> };
		},
	) => void;
};

type EmbeddedSignupPayload = {
	type?: string;
	event?: string;
	data?: {
		waba_id?: string;
		phone_number_id?: string;
		business_id?: string;
	};
};

type CompleteEmbeddedSignupInput = {
	code: string;
	wabaId: string;
	phoneNumberId: string;
	businessId?: string;
};

declare global {
	interface Window {
		FB?: FacebookSdk;
		fbAsyncInit?: () => void;
	}
}

const DEFAULT_CLOUD_API_VERSION = "v22.0";
const FACEBOOK_SDK_SCRIPT_ID = "facebook-jssdk";
const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? "";
const WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID =
	process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID ?? "";

const getMissingClientConfig = () =>
	[
		META_APP_ID ? null : "NEXT_PUBLIC_META_APP_ID",
		WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID
			? null
			: "NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID",
	].filter((key): key is string => Boolean(key));

const isFacebookOrigin = (origin: string) => {
	try {
		const host = new URL(origin).hostname;
		return host === "facebook.com" || host.endsWith(".facebook.com");
	} catch {
		return false;
	}
};

const parseEmbeddedSignupPayload = (value: string) => {
	try {
		return JSON.parse(value) as EmbeddedSignupPayload;
	} catch {
		return null;
	}
};

const loadFacebookSdk = () =>
	new Promise<FacebookSdk>((resolve, reject) => {
		if (typeof window === "undefined") {
			reject(new Error("Facebook SDK can only load in the browser"));
			return;
		}

		if (window.FB) {
			resolve(window.FB);
			return;
		}

		window.fbAsyncInit = () => {
			if (!window.FB) {
				reject(new Error("Facebook SDK failed to initialize"));
				return;
			}

			window.FB.init({
				appId: META_APP_ID,
				autoLogAppEvents: true,
				xfbml: true,
				version: DEFAULT_CLOUD_API_VERSION,
			});
			resolve(window.FB);
		};

		if (document.getElementById(FACEBOOK_SDK_SCRIPT_ID)) {
			const waitForSdk = () => {
				if (window.FB) {
					resolve(window.FB);
					return;
				}

				window.setTimeout(waitForSdk, 50);
			};

			waitForSdk();
			return;
		}

		const script = document.createElement("script");
		script.id = FACEBOOK_SDK_SCRIPT_ID;
		script.async = true;
		script.defer = true;
		script.crossOrigin = "anonymous";
		script.src = "https://connect.facebook.net/en_US/sdk.js";
		script.onerror = () => reject(new Error("Failed to load Facebook SDK"));
		document.body.appendChild(script);
	});

export function useWhatsAppEmbeddedSignup({
	onComplete,
}: {
	onComplete: (input: CompleteEmbeddedSignupInput) => Promise<void>;
}) {
	const sdkRef = useRef<FacebookSdk | null>(null);
	const sdkLoadRef = useRef<Promise<FacebookSdk> | null>(null);
	const codeRef = useRef<string | null>(null);
	const dataRef = useRef<NonNullable<EmbeddedSignupPayload["data"]> | null>(
		null,
	);
	const completedRef = useRef(false);
	const onCompleteRef = useRef(onComplete);
	const missingConfig = getMissingClientConfig();
	const configured = missingConfig.length === 0;

	useEffect(() => {
		onCompleteRef.current = onComplete;
	}, [onComplete]);

	useEffect(() => {
		if (!configured) {
			return;
		}

		sdkLoadRef.current = loadFacebookSdk()
			.then((facebook) => {
				sdkRef.current = facebook;
				return facebook;
			})
			.catch((error) => {
				sdkLoadRef.current = null;
				throw error;
			});
	}, [configured]);

	const reset = () => {
		codeRef.current = null;
		dataRef.current = null;
		completedRef.current = false;
	};

	const completeIfReady = async () => {
		const code = codeRef.current;
		const data = dataRef.current;

		if (
			completedRef.current ||
			!code ||
			!data?.waba_id ||
			!data.phone_number_id
		) {
			return;
		}

		completedRef.current = true;

		try {
			await onCompleteRef.current({
				code,
				wabaId: data.waba_id,
				phoneNumberId: data.phone_number_id,
				businessId: data.business_id,
			});
			reset();
		} catch {
			completedRef.current = false;
		}
	};

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (
				!isFacebookOrigin(event.origin) ||
				typeof event.data !== "string"
			) {
				return;
			}

			const payload = parseEmbeddedSignupPayload(event.data);
			if (payload?.type !== "WA_EMBEDDED_SIGNUP") {
				return;
			}

			if (payload.event === "FINISH" && payload.data) {
				dataRef.current = payload.data;
				void completeIfReady();
				return;
			}

			if (payload.event === "CANCEL") {
				reset();
				toast.info("WhatsApp setup cancelled");
				return;
			}

			if (payload.event === "ERROR") {
				reset();
				toast.error("WhatsApp setup failed in Meta");
			}
		};

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	});

	const launch = async () => {
		if (!configured) {
			toast.error(
				`Missing ${missingConfig.join(", ")}. Restart the Next dev server after updating .env.local.`,
			);
			return;
		}

		reset();

		try {
			const facebook =
				sdkRef.current ??
				(await (sdkLoadRef.current ?? loadFacebookSdk()));
			sdkRef.current = facebook;
			facebook.login(
				(response) => {
					const code = response.authResponse?.code;
					if (!code) {
						reset();
						toast.error(
							"Meta did not return an authorization code",
						);
						return;
					}

					codeRef.current = code;
					void completeIfReady();
				},
				{
					config_id: WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID,
					response_type: "code",
					override_default_response_type: true,
					extras: {
						setup: {},
					},
				},
			);
		} catch (error) {
			reset();
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to launch WhatsApp setup",
			);
		}
	};

	return { configured, launch };
}
