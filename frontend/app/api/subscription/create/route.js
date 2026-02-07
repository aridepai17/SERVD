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
	const auth = Buffer.from(
		`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`,
	).toString("base64");

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

		// Try to find existing customer by email
		let customerId = existingUser.razorpayCustomerId;
		if (!customerId) {
			console.log("Searching for existing customer by email...");
			try {
				// Try to fetch customer by email using Razorpay's customer list API
				const customers = await razorpayFetch(
					`/customers?email=${encodeURIComponent(email)}`,
				);
				if (customers.items && customers.items.length > 0) {
					customerId = customers.items[0].id;
					console.log("Found existing customer:", customerId);
				}
			} catch (searchError) {
				console.log("Customer search failed, will create new");
			}
		}

		// Create customer if not found
		if (!customerId) {
			console.log("Creating new Razorpay customer...");
			try {
				const customer = await razorpayFetch("/customers", "POST", {
					name: `${firstName} ${lastName}`.trim() || "Customer",
					email: email,
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
						error:
							customerError.error?.description ||
							"Failed to create Razorpay customer",
						details: customerError.error,
					},
					{ status: customerError.statusCode || 500 },
				);
			}
		} else {
			console.log("Using existing customer ID:", customerId);
		}

		// Validate plan ID
		if (!RAZORPAY_PLAN_ID || RAZORPAY_PLAN_ID === "plan_YOUR_PLAN_ID") {
			return NextResponse.json(
				{ error: "Invalid Razorpay plan ID" },
				{ status: 400 },
			);
		}

		// Fetch plan details
		console.log("Fetching plan details:", RAZORPAY_PLAN_ID);
		const plan = await razorpayFetch(`/plans/${RAZORPAY_PLAN_ID}`);
		console.log("Plan amount:", plan.item?.amount, "paise");

		if (!process.env.NEXT_PUBLIC_APP_URL) {
			return NextResponse.json(
				{ error: "Server misconfiguration: callback URL not set" },
				{ status: 500 },
			);
		}

		// Create a Payment Link for the subscription
		// Payment Links provide a hosted checkout page
		const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/subscription/callback`;
		const paymentLink = await razorpayFetch("/payment_links", "POST", {
			amount: plan.item?.amount || 39900, // Use plan amount
			currency: "INR",
			description:
				plan.item?.description ||
				"Monthly Subscription - Head Chef Pro",
			customer_id: customerId,
			callback_url: callbackUrl,
			expire_by: Math.floor(Date.now() / 1000) + 1800, // 30 minutes expiry
			notes: {
				subscription_type: "monthly",
				user_id: user.id,
			},
		});

		console.log("Payment Link created:", paymentLink.id);
		console.log("Payment Link short URL:", paymentLink.short_url);

		return NextResponse.json({
			success: true,
			subscriptionId: paymentLink.id,
			authUrl: paymentLink.short_url,
		});
	} catch (error) {
		console.error("Subscription creation error:", error);
		return NextResponse.json(
			{
				error:
					error.error?.description ||
					error.message ||
					"Failed to create subscription",
				details: error.error || null,
			},
			{ status: error.statusCode || 500 },
		);
	}
}
