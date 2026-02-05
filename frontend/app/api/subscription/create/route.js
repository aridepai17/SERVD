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
			}
		);
		const existingUserData = await existingUserResponse.json();
		const existingUsers = Array.isArray(existingUserData)
			? existingUserData
			: existingUserData.data || [];
		const existingUser = existingUsers[0];

		if (existingUser?.razorpayCustomerId) {
			customerId = existingUser.razorpayCustomerId;
		} else {
			// Create customer in Razorpay
			const customer = await razorpay.customers.create({
				name: `${firstName} ${lastName}`.trim(),
				email,
				clerkId: user.id,
			});

			customerId = customer.id;

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
		// Replace with your actual plan ID from Razorpay Dashboard
		const PLAN_ID = process.env.RAZORPAY_PLAN_ID || "plan_YOUR_PLAN_ID";

		const subscription = await razorpay.subscriptions.create({
			customer_id: customerId,
			plan_id: PLAN_ID,
			total_count: 0, // 0 = infinite billing until cancelled
			quantity: 1,
			customer_notify: 1,
			notify_info: {
				email,
			},
		});

		return NextResponse.json({
			success: true,
			subscriptionId: subscription.id,
			checkoutUrl: subscription.short_url,
		});
	} catch (error) {
		console.error("Subscription creation error:", error);
		return NextResponse.json(
			{ error: error.message || "Failed to create subscription" },
			{ status: 500 }
		);
	}
}
