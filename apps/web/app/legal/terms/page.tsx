import type { Metadata } from "next";
import { LegalPage } from "@/modules/legal/components/LegalPage";
import { termsSections } from "@/modules/legal/content";

export const metadata: Metadata = {
	title: "Terms and Conditions",
};

export default function TermsPage() {
	return (
		<LegalPage
			title="Terms and Conditions"
			description="The terms governing access to and use of the Stuwiz software platform and related services."
			sections={termsSections}
		/>
	);
}
