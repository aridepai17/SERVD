import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

const STRAPI_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

async function razorpayFetch(endpoint, method = "GET", body = null) {
	const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

	const options = {
		method,
		headers: {
			Authorization: `Basic ${auth}`,
			"Content-Type": "application/json",
		},
	};

	if (body) {
		options.body = JSON.stringify(body);
	}

	const response = await fetch(`${RAZORPAY_API_BASE}${endpoint}`, options);
	const data = await response.json();

	if (!response.ok) {
		throw {
			statusCode: response.status,
			error: data,
		};
	}

	return data;
}

export async function POST(req) {
	try {
		const user = await currentUser();

		if (!user) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		}

		// Fetch user's subscription ID from Strapi
		const response = await fetch(
			`${STRAPI_URL}/api/users?filters[clerkId][$eq]=${user.id}`,
			{
				headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
			},
		);

		const data = await response.json();
		const users = Array.isArray(data) ? data : data.data || [];
		const existingUser = users[0];

		if (!existingUser?.razorpaySubscriptionId) {
			return NextResponse.json(
				{ error: "No active subscription found" },
				{ status: 400 },
			);
		}

		const subscriptionId = existingUser.razorpaySubscriptionId;

		if (existingUser.razorpaySubscriptionStatus === "cancelled") {
			return NextResponse.json({
				success: true,
				message: "Subscription already cancelled",
			});
		}

		console.log("Cancelling subscription:", subscriptionId);

		// Cancel subscription in Razorpay using direct API
		await razorpayFetch(`/subscriptions/${subscriptionId}/cancel`, "POST");

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
			{
				error: error.error?.description || error.message || "Failed to cancel subscription",
				details: error.error || null,
			},
			{ status: error.statusCode || 500 },
		);
	}
}
