import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

const STRAPI_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

export async function POST(req) {
	try {
		const user = await currentUser();

		if (!user) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		}

		const { subscriptionId, paymentId } = await req.json();

		if (!subscriptionId) {
			return NextResponse.json(
				{ error: "Subscription ID required" },
				{ status: 400 },
			);
		}

		// Find user in Strapi
		const userResponse = await fetch(
			`${STRAPI_URL}/api/users?filters[clerkId][$eq]=${user.id}`,
			{
				headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
			},
		);
		const userData = await userResponse.json();
		const existingUsers = Array.isArray(userData)
			? userData
			: userData.data || [];
		const strapiUser = existingUsers[0];

		if (!strapiUser) {
			return NextResponse.json(
				{ error: "User not found" },
				{ status: 404 },
			);
		}

		// Update user subscription status
		await fetch(`${STRAPI_URL}/api/users/${strapiUser.id}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${STRAPI_API_TOKEN}`,
			},
			body: JSON.stringify({
				subscriptionTier: "pro",
				razorpaySubscriptionId: subscriptionId,
				razorpaySubscriptionStatus: "active",
				razorpayPaymentId: paymentId || null,
			}),
		});

		console.log(
			`Subscription verified for user ${user.id}: ${subscriptionId}`,
		);

		return NextResponse.json({
			success: true,
			message: "Subscription activated",
		});
	} catch (error) {
		console.error("Subscription verification error:", error);
		return NextResponse.json(
			{ error: "Verification failed" },
			{ status: 500 },
		);
	}
}
