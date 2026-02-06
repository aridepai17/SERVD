import { NextResponse } from "next/server";
import crypto from "crypto";

function getBaseUrl() {
	const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
	if (!baseUrl) {
		throw new Error("NEXT_PUBLIC_APP_URL is not configured");
	}
	return baseUrl;
}

export async function POST(req) {
	try {
		const formData = await req.formData();

		// Extract Razorpay's POSTed fields (unprefixed params)
		const razorpaySubscriptionId = formData.get("razorpay_subscription_id");
		const razorpayPaymentId = formData.get("razorpay_payment_id");
		const razorpaySignature = formData.get("razorpay_signature");
		const errorCode = formData.get("error_code");
		const errorDescription = formData.get("error_description");

		// Verify signature (skip if error callback)
		if (razorpayPaymentId && razorpaySubscriptionId && razorpaySignature) {
			const expectedSignature = crypto
				.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
				.update(`${razorpayPaymentId}|${razorpaySubscriptionId}`)
				.digest("hex");

			if (expectedSignature !== razorpaySignature) {
				console.log("Invalid Razorpay signature in callback");
				// Redirect with error - validate baseUrl first
				const baseUrl = getBaseUrl();
				const verifyUrl = new URL("/subscription/verify", baseUrl);
				verifyUrl.searchParams.set("error_code", "signature_invalid");
				verifyUrl.searchParams.set(
					"error_description",
					"Payment verification failed",
				);
				return NextResponse.redirect(verifyUrl.toString(), 303);
			}
		}

		console.log("Razorpay callback received:");
		console.log("- Subscription ID:", razorpaySubscriptionId);
		console.log("- Payment ID:", razorpayPaymentId);
		console.log("- Error:", errorCode, errorDescription);

		// Get validated base URL
		const baseUrl = getBaseUrl();
		const verifyUrl = new URL("/subscription/verify", baseUrl);

		// Map Razorpay params to our params
		if (razorpaySubscriptionId) {
			verifyUrl.searchParams.set(
				"subscription_id",
				razorpaySubscriptionId,
			);
		}
		if (razorpayPaymentId) {
			verifyUrl.searchParams.set("payment_id", razorpayPaymentId);
		}
		if (errorCode) {
			verifyUrl.searchParams.set("error_code", errorCode);
		}
		if (errorDescription) {
			verifyUrl.searchParams.set("error_description", errorDescription);
		}

		// Redirect to verify page
		return NextResponse.redirect(verifyUrl.toString(), 303);
	} catch (error) {
		console.error("Callback error:", error);

		// Handle missing environment variable
		if (error.message === "NEXT_PUBLIC_APP_URL is not configured") {
			return new NextResponse("Server misconfiguration", { status: 500 });
		}

		// Redirect to verify page with error
		const baseUrl = getBaseUrl();
		const verifyUrl = new URL("/subscription/verify", baseUrl);
		verifyUrl.searchParams.set("error_code", "callback_error");
		verifyUrl.searchParams.set(
			"error_description",
			"An unexpected error occurred during payment callback",
		);

		return NextResponse.redirect(verifyUrl.toString(), 303);
	}
}
