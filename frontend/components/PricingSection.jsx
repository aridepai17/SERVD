import React, { useState } from "react";
import { Check } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { toast } from "sonner";

export default function PricingSection({ subscriptionTier = "free" }) {
	// INR pricing - ₹399 (marketing pricing)
	const PRO_PRICE_INR = 399;
	const [isLoading, setIsLoading] = useState(false);
	const { user } = useUser();

	const handleSubscribe = async () => {
		if (!user) return;

		setIsLoading(true);
		try {
			const res = await fetch("/api/subscription/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: user.id,
					email: user.primaryEmailAddress?.emailAddress,
				}),
			});

			const data = await res.json();

			if (data.checkoutUrl) {
				window.location.href = data.checkoutUrl;
			} else {
				toast.error(data.error || "Failed to create subscription");
			}
		} catch (error) {
			console.error("Subscription error:", error);
			toast.error("Something went wrong");
		} finally {
			setIsLoading(false);
		}
	};

	const handleCancelSubscription = async () => {
		if (!confirm("Are you sure you want to cancel your subscription?")) return;

		setIsLoading(true);
		try {
			const res = await fetch("/api/subscription/cancel", {
				method: "POST",
			});

			const data = await res.json();

			if (data.success) {
				toast.success("Subscription cancelled successfully");
				// Force reload to update UI
				window.location.reload();
			} else {
				toast.error(data.error || "Failed to cancel subscription");
			}
		} catch (error) {
			console.error("Cancellation error:", error);
			toast.error("Something went wrong");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="max-w-6xl mx-auto">
			<div className="mb-16">
				<h2 className="text-5xl md:text-6xl font-bold mb-4">
					Simple Pricing
				</h2>
				<p className="text-xl text-stone-600 font-light">
					Start for free. Upgrade to become a master chef.
				</p>
			</div>

			<div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
				{/* Free Plan */}
				<Card className="border-2 border-stone-200 bg-white">
					<CardHeader>
						<CardTitle className="text-3xl font-bold">
							Sous Chef
						</CardTitle>
						<div className="text-5xl font-bold text-stone-900">
							₹0
							<span className="text-lg font-normal text-stone-400">
								/mo
							</span>
						</div>
						<CardDescription className="text-stone-600 font-light text-base">
							Perfect for casual weekly cooks.
						</CardDescription>
					</CardHeader>

					<CardContent>
						<ul className="space-y-4">
							{[
								"10 pantry scans per month",
								"5 AI meal recommendations",
								"Standard support",
								"Standard Recipes",
							].map((item, i) => (
								<li
									key={i}
									className="flex gap-3 text-stone-700"
								>
									<Check className="h-5 w-5 shrink-0 mt-0.5 text-stone-400" />
									<span>{item}</span>
								</li>
							))}
						</ul>
					</CardContent>

					<CardFooter className={"mt-auto"}>
						<Link href="/dashboard" className="w-full">
							<Button
								variant="outline"
								className="w-full border-2 border-stone-900 hover:bg-stone-900 hover:text-white"
							>
								Get Started
							</Button>
						</Link>
					</CardFooter>
				</Card>

				{/* Pro Plan */}
				<Card className="relative border-2 border-orange-600 bg-orange-50">
					<Badge className="absolute top-0 right-0 rounded-none rounded-bl-lg bg-orange-600 text-white font-bold uppercase tracking-wide border-none">
						MOST POPULAR
					</Badge>

					<CardHeader>
						<CardTitle className="text-3xl font-bold text-orange-900">
							Head Chef
						</CardTitle>
						<div className="text-5xl font-bold text-orange-600">
							₹{PRO_PRICE_INR}
							<span className="text-lg font-normal text-orange-400">
								/mo
							</span>
						</div>
						<CardDescription className="text-orange-800/70 font-light text-base">
							For the serious home cook.
						</CardDescription>
					</CardHeader>

					<CardContent>
						<ul className="space-y-4">
							{[
								"Unlimited pantry scans",
								"Unlimited AI recipes",
								"Priority Support",
								"Recipes with Nutritional analysis",
								"Chef's Tips & Tricks",
								"Ingredient Substitutions",
							].map((item, i) => (
								<li
									key={i}
									className="flex gap-3 text-orange-950"
								>
									<Badge className="bg-orange-200 p-1 rounded-full h-6 w-6 flex items-center justify-center border-none">
										<Check className="h-4 w-4 text-orange-700" />
									</Badge>
									<span className="font-medium">{item}</span>
								</li>
							))}
						</ul>
					</CardContent>

					<CardFooter className="flex flex-col gap-3">
						<SignedIn>
							{subscriptionTier === "pro" ? (
								<>
									<Button
										disabled
										className="w-full bg-green-600 text-white cursor-default"
									>
										Current Plan
									</Button>
									<Button
										variant="outline"
										onClick={handleCancelSubscription}
										disabled={isLoading}
										className="w-full border-2 border-red-600 text-red-600 hover:bg-red-50"
									>
										{isLoading
											? "Cancelling..."
											: "Cancel Subscription"}
									</Button>
								</>
							) : (
								<Button
									onClick={handleSubscribe}
									disabled={isLoading}
									className="w-full bg-orange-600 hover:bg-orange-700 text-white"
								>
									{isLoading ? "Loading..." : "Subscribe Now"}
								</Button>
							)}
						</SignedIn>
						<SignedOut>
							<SignInButton mode="modal">
								<Button variant="primary" className="w-full">
									Login to Subscribe
								</Button>
							</SignInButton>
						</SignedOut>
					</CardFooter>
				</Card>
			</div>
		</div>
	);
}
