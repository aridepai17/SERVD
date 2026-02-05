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

		// Check if customer already exists in Strapi
		let customerId = null;
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

		if (existingUser?.razorpayCustomerId) {
			customerId = existingUser.razorpayCustomerId;
			console.log("Using existing Razorpay customer ID:", customerId);
		} else {
			// Create customer in Razorpay using direct API
			console.log("Creating new Razorpay customer...");
			try {
				const customer = await razorpayFetch("/customers", "POST", {
					name: `${firstName} ${lastName}`.trim() || "Customer",
					email,
					notes: { clerkId: user.id },
				});
				customerId = customer.id;
				console.log("Customer created:", customerId);

				// Save customer ID to Strapi
				await fetch(`${STRAPI_URL}/api/users/${existingUser.id}`, {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${STRAPI_API_TOKEN}`,
					},
					body: JSON.stringify({
						razorpayCustomerId: customerId,
					}),
				});
			} catch (customerError) {
				console.error("Customer creation failed:", customerError);
				return NextResponse.json(
					{
						error: customerError.error?.description || "Failed to create Razorpay customer",
						details: customerError.error,
					},
					{ status: customerError.statusCode || 500 },
				);
			}
		}

		// Validate plan ID
		if (!RAZORPAY_PLAN_ID || RAZORPAY_PLAN_ID === "plan_YOUR_PLAN_ID") {
			return NextResponse.json(
				{ error: "Invalid Razorpay plan ID" },
				{ status: 400 },
			);
		}

		console.log("Creating subscription for customer:", customerId);

		// Create subscription
		const subscription = await razorpayFetch("/subscriptions", "POST", {
			customer_id: customerId,
			plan_id: RAZORPAY_PLAN_ID,
			total_count: 12, // 12 months
			quantity: 1,
			customer_notify: 1,
			notify_info: {
				email,
			},
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
