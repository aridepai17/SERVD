"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function SubscriptionVerifyClient() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const [status, setStatus] = useState("verifying");
	const [message, setMessage] = useState("Verifying your subscription...");

	useEffect(() => {
		let redirectTimer;
		const verifySubscription = async () => {
			const subscriptionId = searchParams.get("razorpay_subscription_id");
			const paymentId = searchParams.get("razorpay_payment_id");
			const errorCode = searchParams.get("error_code");
			const errorDescription = searchParams.get("error_description");

			// Check for payment errors
			if (errorCode) {
				setStatus("error");
				setMessage(`Payment failed: ${errorDescription || errorCode}`);
				redirectTimer = setTimeout(
					() => router.push("/dashboard"),
					5000,
				);
				return;
			}

			if (!subscriptionId) {
				setStatus("error");
				setMessage("No subscription ID found");
				redirectTimer = setTimeout(
					() => router.push("/dashboard"),
					5000,
				);
				return;
			}

			try {
				// Update user subscription status in Strapi
				const response = await fetch("/api/subscription/verify", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						subscriptionId,
						paymentId,
					}),
				});

				const data = await response.json();

				if (data.success) {
					setStatus("success");
					setMessage(
						"Subscription activated successfully! Redirecting to dashboard...",
					);
					redirectTimer = setTimeout(
						() => router.push("/dashboard"),
						3000,
					);
				} else {
					setStatus("error");
					setMessage(data.error || "Verification failed");
					redirectTimer = setTimeout(
						() => router.push("/dashboard"),
						5000,
					);
				}
			} catch (error) {
				console.error("Verification error:", error);
				setStatus("error");
				setMessage("Something went wrong during verification");
				redirectTimer = setTimeout(
					() => router.push("/dashboard"),
					5000,
				);
			}
		};

		verifySubscription();
		return () => clearTimeout(redirectTimer);
	}, [searchParams, router]);

	return (
		<div className="min-h-screen flex items-center justify-center bg-stone-50">
			<div className="text-center">
				{status === "verifying" && (
					<>
						<Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto mb-4" />
						<h1 className="text-2xl font-bold text-stone-900 mb-2">
							Verifying Subscription
						</h1>
						<p className="text-stone-600">{message}</p>
					</>
				)}

				{status === "success" && (
					<>
						<div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
							<svg
								className="h-6 w-6 text-green-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M5 13l4 4L19 7"
								/>
							</svg>
						</div>
						<h1 className="text-2xl font-bold text-stone-900 mb-2">
							Subscription Active!
						</h1>
						<p className="text-stone-600">{message}</p>
					</>
				)}

				{status === "error" && (
					<>
						<div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
							<svg
								className="h-6 w-6 text-red-600"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</div>
						<h1 className="text-2xl font-bold text-stone-900 mb-2">
							Something Went Wrong
						</h1>
						<p className="text-stone-600">{message}</p>
					</>
				)}
			</div>
		</div>
	);
}

export default function SubscriptionVerifyPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen flex items-center justify-center bg-stone-50">
					<div className="text-center">
						<Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto mb-4" />
						<h1 className="text-2xl font-bold text-stone-900 mb-2">
							Loading...
						</h1>
					</div>
				</div>
			}
		>
			<SubscriptionVerifyClient />
		</Suspense>
	);
}
