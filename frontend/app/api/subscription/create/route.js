import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { currentUser } from "@clerk/nextjs/server";

const STRAPI_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

const razorpay = new Razorpay({
	key_id: process.env.RAZORPAY_KEY_ID,
	key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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
			// Create customer in Razorpay
			console.log("Creating new Razorpay customer...");
			try {
				const customer = await razorpay.customers.create({
					name: `${firstName} ${lastName}`.trim(),
					email,
					notes: { clerkId: user.id },
				});
				customerId = customer.id;
				console.log("Customer created:", customerId);
			} catch (customerError) {
				console.error("Customer creation failed:", customerError);
				throw customerError;
			}

			// Save customer ID to Strapi
			if (existingUser) {
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
			}
		}

		// Create subscription
		const PLAN_ID = process.env.RAZORPAY_PLAN_ID;
		console.log("Using plan ID:", PLAN_ID);

		if (!PLAN_ID || PLAN_ID === "plan_YOUR_PLAN_ID") {
			return NextResponse.json(
				{ error: "Invalid Razorpay plan ID. Please configure RAZORPAY_PLAN_ID in environment variables." },
				{ status: 400 },
			);
		}

		console.log("Creating subscription for customer:", customerId);
		const subscription = await razorpay.subscriptions.create({
			customer_id: customerId,
			plan_id: PLAN_ID,
			total_count: 1,
			quantity: 1,
			customer_notify: 1,
			notify_info: {
				email,
			},
		});

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
		// Log more details for debugging
		if (error.error) {
			console.error("Razorpay error details:", JSON.stringify(error.error, null, 2));
		}
		return NextResponse.json(
			{
				error: error.message || error.error?.description || "Failed to create subscription",
				details: error.error || null,
			},
			{ status: error.statusCode || 500 },
		);
	}
}
