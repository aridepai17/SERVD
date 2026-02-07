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

		return handleCallback({
			razorpaySubscriptionId,
			razorpayPaymentId,
			razorpaySignature,
			errorCode,
			errorDescription,
		});
	} catch (error) {
		console.error("Callback error:", error);
		return handleCallbackError(error);
	}
}

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);

		// Extract Razorpay's GET params (from Payment Links)
		const razorpayPaymentId = searchParams.get("razorpay_payment_id");
		const razorpayPaymentLinkId = searchParams.get(
			"razorpay_payment_link_id",
		);
		const razorpayPaymentLinkReferenceId = searchParams.get(
			"razorpay_payment_link_reference_id",
		);
		const razorpayPaymentLinkStatus = searchParams.get(
			"razorpay_payment_link_status",
		);
		const razorpaySignature = searchParams.get("razorpay_signature");
		const errorCode = searchParams.get("error_code");
		const errorDescription = searchParams.get("error_description");

		console.log("Payment Link callback received:");
		console.log("- Payment ID:", razorpayPaymentId);
		console.log("- Payment Link ID:", razorpayPaymentLinkId);
		console.log(
			"- Payment Link Reference ID:",
			razorpayPaymentLinkReferenceId,
		);
		console.log("- Status:", razorpayPaymentLinkStatus);

		return handleCallback({
			razorpaySubscriptionId: razorpayPaymentLinkId,
			razorpayPaymentId,
			razorpaySignature,
			errorCode,
			errorDescription,
			isPaymentLink: true,
			razorpayPaymentLinkReferenceId,
			razorpayPaymentLinkStatus,
		});
	} catch (error) {
		console.error("Callback error:", error);
		return handleCallbackError(error);
	}
}

function handleCallback({
	razorpaySubscriptionId,
	razorpayPaymentId,
	razorpaySignature,
	errorCode,
	errorDescription,
	isPaymentLink = false,
	razorpayPaymentLinkReferenceId = null,
	razorpayPaymentLinkStatus = null,
}) {
	// Verify signature for Payment Links
	if (isPaymentLink && razorpayPaymentId && razorpaySignature) {
		const expectedSignature = crypto
			.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
			.update(
				`${razorpaySubscriptionId}|${razorpayPaymentLinkReferenceId}|${razorpayPaymentLinkStatus}|${razorpayPaymentId}`,
			)
			.digest("hex");

		if (expectedSignature !== razorpaySignature) {
			console.log("Invalid Razorpay signature in Payment Link callback");
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

	// Verify signature for Subscriptions
	if (
		!isPaymentLink &&
		razorpayPaymentId &&
		razorpaySignature &&
		razorpaySubscriptionId
	) {
		const expectedSignature = crypto
			.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
			.update(`${razorpayPaymentId}|${razorpaySubscriptionId}`)
			.digest("hex");

		if (expectedSignature !== razorpaySignature) {
			console.log("Invalid Razorpay signature in subscription callback");
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
	console.log("- Subscription/Payment Link ID:", razorpaySubscriptionId);
	console.log("- Payment ID:", razorpayPaymentId);
	console.log("- Error:", errorCode, errorDescription);

	const baseUrl = getBaseUrl();
	const verifyUrl = new URL("/subscription/verify", baseUrl);

	if (razorpaySubscriptionId) {
		verifyUrl.searchParams.set("subscription_id", razorpaySubscriptionId);
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

	return NextResponse.redirect(verifyUrl.toString(), 303);
}

function handleCallbackError(error) {
	let baseUrl;
	try {
		baseUrl = getBaseUrl();
	} catch {
		return new NextResponse("Server misconfiguration", { status: 500 });
	}

	const verifyUrl = new URL("/subscription/verify", baseUrl);
	verifyUrl.searchParams.set("error_code", "callback_error");
	verifyUrl.searchParams.set(
		"error_description",
		"An unexpected error occurred during payment callback",
	);

	return NextResponse.redirect(verifyUrl.toString(), 303);
}
