import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { currentUser } from "@clerk/nextjs/server";

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

const razorpay = new Razorpay({
	key_id: process.env.RAZORPAY_KEY_ID,
	key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export async function POST(req) {
	try {
		const user = await currentUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Fetch user's subscription ID from Strapi
		const response = await fetch(
			`${STRAPI_URL}/api/users?filters[clerkId][$eq]=${user.id}`,
			{
				headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
			}
		);

		const data = await response.json();
		const users = Array.isArray(data) ? data : (data.data || []);
		const existingUser = users[0];

		if (!existingUser?.razorpaySubscriptionId) {
			return NextResponse.json(
				{ error: "No active subscription found" },
				{ status: 400 }
			);
		}

		const subscriptionId = existingUser.razorpaySubscriptionId;

		// Cancel subscription in Razorpay
		await razorpay.subscriptions.cancel(subscriptionId);

		// Update Strapi to free tier
		await fetch(`${STRAPI_URL}/api/users/${existingUser.id}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${STRAPI_API_TOKEN}`,
			},
			body: JSON.stringify({
				subscriptionTier: "free",
				razorpaySubscriptionStatus: "cancelled",
			}),
		});

		return NextResponse.json({
			success: true,
			message: "Subscription cancelled successfully",
		});
	} catch (error) {
		console.error("Subscription cancellation error:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to cancel subscription" },
			{ status: 500 }
		);
	}
}
