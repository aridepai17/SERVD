import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

const STRAPI_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_PLAN_ID = process.env.RAZORPAY_PLAN_ID;

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

		const { email, firstName, lastName } = {
			email: user.emailAddresses?.[0]?.emailAddress,
			firstName: user.firstName || "",
			lastName: user.lastName || "",
		};

		console.log("Processing subscription for user:", user.id);
		console.log("Email:", email);

		// Check if user already has subscription
		const existingUserResponse = await fetch(
			`${STRAPI_URL}/api/users?filters[clerkId][$eq]=${user.id}`,
			{
				headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
			},
		);
		const existingUserData = await existingUserResponse.json();
		const existingUsers = Array.isArray(existingUserData)
			? existingUserData
			: existingUserData.data || [];
		const existingUser = existingUsers[0];

		if (!existingUser) {
			return NextResponse.json(
				{ error: "User record not found in Strapi" },
				{ status: 404 },
			);
		}

		if (
			existingUser.subscriptionTier === "pro" ||
			existingUser.razorpaySubscriptionStatus === "active"
		) {
			return NextResponse.json(
				{ error: "Subscription already active" },
				{ status: 409 },
			);
		}

		// Skip customer creation - use customer_create_with_razorpay in subscription
		// This creates the customer inline when creating subscription
		const customerName = `${firstName} ${lastName}`.trim() || "Customer";
		console.log("Creating subscription with inline customer:", customerName, email);

		// Create subscription with inline customer creation
		const subscription = await razorpayFetch("/subscriptions", "POST", {
			customer_create_with_razorpay: true,
			customer: {
				name: customerName,
				email: email,
				notes: { clerkId: user.id },
			},
			plan_id: RAZORPAY_PLAN_ID,
			total_count: 12,
			quantity: 1,
			customer_notify: 1,
			notify_info: { email },
		});

		console.log("Subscription created:", subscription.id);

		if (!subscription.short_url) {
			return NextResponse.json(
				{ error: "Checkout URL missing from Razorpay response" },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			subscriptionId: subscription.id,
			checkoutUrl: subscription.short_url,
		});
	} catch (error) {
		console.error("Subscription creation error:", error);
		return NextResponse.json(
			{
				error: error.error?.description || error.message || "Failed to create subscription",
				details: error.error || null,
			},
			{ status: error.statusCode || 500 },
		);
	}
}
