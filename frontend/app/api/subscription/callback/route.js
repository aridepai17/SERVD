import { NextResponse } from "next/server";

export async function POST(req) {
	try {
		const formData = await req.formData();

		// Extract Razorpay's POSTed fields (unprefixed params)
		const razorpaySubscriptionId = formData.get("razorpay_subscription_id");
		const razorpayPaymentId = formData.get("razorpay_payment_id");
		const errorCode = formData.get("error_code");
		const errorDescription = formData.get("error_description");

		console.log("Razorpay callback received:");
		console.log("- Subscription ID:", razorpaySubscriptionId);
		console.log("- Payment ID:", razorpayPaymentId);
		console.log("- Error:", errorCode, errorDescription);

		// Build redirect URL with params - use request headers for dynamic base URL
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
			|| `https://${req.headers.get("host") || "localhost:3000"}`;
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
		return NextResponse.redirect(verifyUrl.toString());
	} catch (error) {
		console.error("Callback error:", error);

		// Redirect to verify page with error on failure
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL 
			|| `https://${req.headers.get("host") || "localhost:3000"}`;
		const verifyUrl = new URL("/subscription/verify", baseUrl);
		verifyUrl.searchParams.set("error_code", "callback_error");
		verifyUrl.searchParams.set("error_description", error.message);

		return NextResponse.redirect(verifyUrl.toString());
	}
}
