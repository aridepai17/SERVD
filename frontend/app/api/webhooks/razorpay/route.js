import { NextResponse } from "next/server";
import crypto from "crypto";

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

export async function POST(req) {
	try {
		const body = await req.text();
		const signature = req.headers.get("x-razorpay-signature");

		// Verify webhook signature
		const expectedSignature = crypto
			.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
			.update(body)
			.digest("hex");

		if (signature !== expectedSignature) {
			console.error("Invalid webhook signature");
			return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
		}

		const event = JSON.parse(body);
		console.log("Razorpay webhook event:", event.event);

		// Handle different events
		switch (event.event) {
			case "payment.authorized":
			case "payment.captured":
				await handlePaymentSuccess(event.payload.payment);
				break;
			case "payment.failed":
				await handlePaymentFailed(event.payload.payment);
				break;
			case "subscription.authenticated":
				await handleSubscriptionAuthenticated(event.payload.subscription);
				break;
			case "subscription.activated":
				await handleSubscriptionActivated(event.payload.subscription);
				break;
			case "subscription.paused":
				await handleSubscriptionPaused(event.payload.subscription);
				break;
			case "subscription.resumed":
				await handleSubscriptionResumed(event.payload.subscription);
				break;
			case "subscription.charged":
				await handleSubscriptionCharged(event.payload.subscription);
				break;
			case "subscription.cancelled":
				await handleSubscriptionCancelled(event.payload.subscription);
				break;
			case "subscription.completed":
				await handleSubscriptionCompleted(event.payload.subscription);
				break;
			case "subscription.updated":
				await handleSubscriptionUpdated(event.payload.subscription);
				break;
			default:
				console.log("Unhandled event:", event.event);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Webhook error:", error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

async function findUserByCustomerId(customerId) {
	const response = await fetch(
		`${STRAPI_URL}/api/users?filters[razorpayCustomerId][$eq]=${customerId}`,
		{
			headers: {
				Authorization: `Bearer ${STRAPI_API_TOKEN}`,
			},
		}
	);

	const data = await response.json();
	const users = Array.isArray(data) ? data : (data.data || []);
	return users[0] || null;
}

async function findUserBySubscriptionId(subscriptionId) {
	const response = await fetch(
		`${STRAPI_URL}/api/users?filters[razorpaySubscriptionId][$eq]=${subscriptionId}`,
		{
			headers: {
				Authorization: `Bearer ${STRAPI_API_TOKEN}`,
			},
		}
	);

	const data = await response.json();
	const users = Array.isArray(data) ? data : (data.data || []);
	return users[0] || null;
}

async function updateUserSubscription(user, updates) {
	if (!user) return;

	await fetch(`${STRAPI_URL}/api/users/${user.id}`, {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${STRAPI_API_TOKEN}`,
		},
		body: JSON.stringify(updates),
	});
}

async function handlePaymentSuccess(payment) {
	const { customer_id, subscription_id } = payment;
	const user = await findUserByCustomerId(customer_id);

	if (user) {
		await updateUserSubscription(user, {
			subscriptionTier: "pro",
			razorpaySubscriptionId: subscription_id,
			razorpaySubscriptionStatus: "active",
			razorpayPaymentStatus: "captured",
		});
		console.log(`User ${user.id} payment successful`);
	}
}

async function handlePaymentFailed(payment) {
	const { customer_id } = payment;
	const user = await findUserByCustomerId(customer_id);

	if (user) {
		await updateUserSubscription(user, {
			subscriptionTier: "free",
			razorpayPaymentStatus: "failed",
		});
		console.log(`User ${user.id} payment failed`);
	}
}

async function handleSubscriptionAuthenticated(subscription) {
	const { customer_id } = subscription;
	const user = await findUserByCustomerId(customer_id);

	if (user) {
		await updateUserSubscription(user, {
			razorpaySubscriptionStatus: "authenticated",
		});
		console.log(`User ${user.id} subscription authenticated`);
	}
}

async function handleSubscriptionActivated(subscription) {
	const { customer_id, id: subscriptionId, plan_id } = subscription;
	const user = await findUserByCustomerId(customer_id);

	if (user) {
		await updateUserSubscription(user, {
			subscriptionTier: "pro",
			razorpaySubscriptionId: subscriptionId,
			razorpayPlanId: plan_id,
			razorpaySubscriptionStatus: "active",
		});
		console.log(`User ${user.id} subscription activated`);
	}
}

async function handleSubscriptionPaused(subscription) {
	const { id: subscriptionId } = subscription;
	const user = await findUserBySubscriptionId(subscriptionId);

	if (user) {
		await updateUserSubscription(user, {
			subscriptionTier: "free",
			razorpaySubscriptionStatus: "paused",
		});
		console.log(`User ${user.id} subscription paused`);
	}
}

async function handleSubscriptionResumed(subscription) {
	const { customer_id, id: subscriptionId, plan_id } = subscription;
	const user = await findUserByCustomerId(customer_id);

	if (user) {
		await updateUserSubscription(user, {
			subscriptionTier: "pro",
			razorpaySubscriptionId: subscriptionId,
			razorpayPlanId: plan_id,
			razorpaySubscriptionStatus: "active",
		});
		console.log(`User ${user.id} subscription resumed`);
	}
}

async function handleSubscriptionCharged(subscription) {
	const { customer_id, id: subscriptionId } = subscription;
	const user = await findUserByCustomerId(customer_id);

	if (user) {
		await updateUserSubscription(user, {
			subscriptionTier: "pro",
			razorpaySubscriptionId: subscriptionId,
			razorpaySubscriptionStatus: "active",
		});
		console.log(`User ${user.id} subscription charged`);
	}
}

async function handleSubscriptionCancelled(subscription) {
	const { id: subscriptionId } = subscription;
	const user = await findUserBySubscriptionId(subscriptionId);

	if (user) {
		await updateUserSubscription(user, {
			subscriptionTier: "free",
			razorpaySubscriptionStatus: "cancelled",
		});
		console.log(`User ${user.id} subscription cancelled`);
	}
}

async function handleSubscriptionCompleted(subscription) {
	const { id: subscriptionId } = subscription;
	const user = await findUserBySubscriptionId(subscriptionId);

	if (user) {
		await updateUserSubscription(user, {
			subscriptionTier: "free",
			razorpaySubscriptionStatus: "completed",
		});
		console.log(`User ${user.id} subscription completed`);
	}
}

async function handleSubscriptionUpdated(subscription) {
	const { id: subscriptionId, plan_id, status } = subscription;
	const user = await findUserBySubscriptionId(subscriptionId);

	if (user) {
		await updateUserSubscription(user, {
			razorpayPlanId: plan_id,
			razorpaySubscriptionStatus: status,
		});
		console.log(`User ${user.id} subscription updated`);
	}
}
