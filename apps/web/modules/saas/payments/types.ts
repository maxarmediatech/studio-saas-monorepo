import type { config } from "@repo/config";

export type PlanId = Extract<keyof typeof config.payments.plans, string>;
