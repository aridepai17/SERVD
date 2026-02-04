import arcjet, { detectBot, shield } from "@arcjet/next";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
	"/recipe(.*)",
	"/recipes(.*)",
	"/pantry(.*)",
	"/dashboard(.*)",
]);

// Arcjet global protection
const aj = arcjet({
	key: process.env.ARCJET_KEY,
	rules: [
		// Shield WAF - protects against SQL injection, XSS, etc.
		shield({
			mode: "LIVE",
		}),

		// Bot detection - allow search engines, block against malicious bots
		detectBot({
			mode: "LIVE",
			allow: [
				"CATEGORY:SEARCH_ENGINE", // Google, Bing, etc.
				"CATEGORY:PREVIEW", // Link previews (Slack, Discord, etc)
			],
		}),
	],
});

export default clerkMiddleware(async (auth, req) => {
	// Apply Arcjet protection FIRST (before Clerk auth check)
	const decision = await aj.protect(req);

	if (decision.isDenied()) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	// Then apply Clerk authentication
	const { userId } = await auth();

	if (!userId && isProtectedRoute(req)) {
		const { redirectToSignIn } = await auth();
		return redirectToSignIn();
	}

	return NextResponse.next();
});

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
