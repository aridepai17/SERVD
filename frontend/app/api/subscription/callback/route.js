import { NextResponse } from "next/server";
import crypto from "crypto";

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
				.update(`${razorpayPaymentId}${razorpaySubscriptionId}`)
				.digest("hex");

			if (expectedSignature !== razorpaySignature) {
				console.log("Invalid Razorpay signature in callback");
				// Redirect with error instead of proceeding
				const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
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

		const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
		if (!baseUrl) {
			console.error("NEXT_PUBLIC_APP_URL is not configured");
			return new NextResponse("Server misconfiguration", { status: 500 });
		}
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

		// Redirect to verify page with error on failure
		const baseUrl =
			process.env.NEXT_PUBLIC_APP_URL ||
			`https://${req.headers.get("host") || "localhost:3000"}`;
		const verifyUrl = new URL("/subscription/verify", baseUrl);
		verifyUrl.searchParams.set("error_code", "callback_error");
		verifyUrl.searchParams.set("error_description", error.message);

		return NextResponse.redirect(verifyUrl.toString(), 303);
	}
}
