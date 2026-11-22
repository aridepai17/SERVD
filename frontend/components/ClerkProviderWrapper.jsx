"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { neobrutalism } from "@clerk/themes";

export default function ClerkProviderWrapper({ children }) {
	return (
		<ClerkProvider appearance={{ baseTheme: neobrutalism }}>
			{children}
		</ClerkProvider>
	);
}
