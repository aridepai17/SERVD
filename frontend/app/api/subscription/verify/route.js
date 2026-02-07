import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

const STRAPI_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL;
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

		let body;
		try {
			body = await req.json();
		} catch {
			return NextResponse.json(
				{ error: "Invalid request body" },
				{ status: 400 },
			);
		}

		const { subscriptionId, paymentId } = body;

		if (!subscriptionId && !paymentId) {
			return NextResponse.json(
				{ error: "Subscription ID or Payment ID required" },
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

		// Check if this is a subscription or payment link
		const isPaymentLink = subscriptionId?.startsWith("plink_");

		if (isPaymentLink) {
			// Verify payment link payment
			let payment;
			try {
				payment = await razorpayFetch(`/payments/${paymentId}`);
			} catch (fetchError) {
				console.error("Failed to fetch payment from Razorpay:", fetchError);
				return NextResponse.json(
					{ error: "Payment not found in Razorpay" },
					{ status: 404 },
				);
			}

			// Verify payment status
			if (payment.status !== "captured") {
				console.error(`Invalid payment status: ${payment.status}`);
				return NextResponse.json(
					{ error: `Payment not completed: ${payment.status}` },
					{ status: 400 },
				);
			}

			// Verify customer_id matches
			if (payment.customer_id !== strapiUser.razorpayCustomerId) {
				console.error(
					`Customer ID mismatch: ${payment.customer_id} vs ${strapiUser.razorpayCustomerId}`,
				);
				return NextResponse.json(
					{ error: "Payment does not belong to this user" },
					{ status: 403 },
				);
			}

			// All checks passed - update user subscription status
			const updateRes = await fetch(`${STRAPI_URL}/api/users/${strapiUser.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${STRAPI_API_TOKEN}`,
				},
				body: JSON.stringify({
					subscriptionTier: "pro",
					razorpaySubscriptionId: subscriptionId,
					razorpaySubscriptionStatus: "active",
					razorpayPaymentId: paymentId,
				}),
			});

			if (!updateRes.ok) {
				console.error("Strapi update failed:", await updateRes.text());
				return NextResponse.json(
					{ error: "Failed to activate subscription" },
					{ status: 500 },
				);
			}

			console.log(
				`Subscription verified for user ${user.id}: ${subscriptionId} (payment: ${paymentId})`,
			);

			return NextResponse.json({
				success: true,
				message: "Subscription activated",
			});
		} else {
			// Original subscription verification logic
			let razorpaySubscription;
			try {
				razorpaySubscription = await razorpayFetch(`/subscriptions/${subscriptionId}`);
			} catch (fetchError) {
				console.error("Failed to fetch subscription from Razorpay:", fetchError);
				return NextResponse.json(
					{ error: "Subscription not found in Razorpay" },
					{ status: 404 },
				);
			}

			// Verify subscription status
			const validStatuses = ["active", "authenticated", "pending"];
			if (!validStatuses.includes(razorpaySubscription.status)) {
				console.error(`Invalid subscription status: ${razorpaySubscription.status}`);
				return NextResponse.json(
					{ error: `Invalid subscription status: ${razorpaySubscription.status}` },
					{ status: 400 },
				);
			}

			// Verify customer_id matches stored customer ID
			if (razorpaySubscription.customer_id !== strapiUser.razorpayCustomerId) {
				console.error(
					`Customer ID mismatch: ${razorpaySubscription.customer_id} vs ${strapiUser.razorpayCustomerId}`,
				);
				return NextResponse.json(
					{ error: "Subscription does not belong to this user" },
					{ status: 403 },
				);
			}

			// All checks passed - update user subscription status
			const updateRes = await fetch(`${STRAPI_URL}/api/users/${strapiUser.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${STRAPI_API_TOKEN}`,
				},
				body: JSON.stringify({
					subscriptionTier: "pro",
					razorpaySubscriptionId: subscriptionId,
					razorpaySubscriptionStatus: razorpaySubscription.status,
					razorpayPaymentId: paymentId || null,
				}),
			});

			if (!updateRes.ok) {
				console.error("Strapi update failed:", await updateRes.text());
				return NextResponse.json(
					{ error: "Failed to activate subscription" },
					{ status: 500 },
				);
			}

			console.log(
				`Subscription verified for user ${user.id}: ${subscriptionId} (status: ${razorpaySubscription.status})`,
			);

			return NextResponse.json({
				success: true,
				message: "Subscription activated",
			});
		}
	} catch (error) {
		console.error("Subscription verification error:", error);
		return NextResponse.json(
			{ error: error.message || "Verification failed" },
			{ status: 500 },
		);
	}
}
