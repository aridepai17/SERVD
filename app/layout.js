import { Inter } from "next/font/google";
import "./globals.css";
import Header from "../components/Header";
import { ClerkProvider } from "@clerk/nextjs";
import { neobrutalism } from "@clerk/themes";

const inter = Inter({
	subsets: ["latin"],
});

export const metadata = {
	title: "SERVD - AI Recipe Platform",
	description:
		"AI-powered recipe platform for discovering and creating delicious meals",
};

export default function RootLayout({ children }) {
	return (
		<ClerkProvider appearance={{ baseTheme: neobrutalism }}>
			<html lang="en" suppressHydrationWarning>
				<body className={`${inter.className}`}>
					<Header />

					<main className="min-h-screen">{children}</main>
					<footer className="py-8 px-4 border-t">
						<div className="max-w-6xl mx-auto flex justify-center items-center">
							<p className="text-stone-500 text-sm">
								Made with ❤️ and a lot of 🍳 by aridepai17
							</p>
						</div>
					</footer>
				</body>
			</html>
		</ClerkProvider>
	);
}
