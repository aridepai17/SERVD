"use client";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import React, { useState } from "react";
import PricingSection from "./PricingSection";
import { X } from "lucide-react";

export default function PricingModal({ subscriptionTier = "free", children }) {
	const [isOpen, setIsOpen] = useState(false);
	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				{children}
			</DialogTrigger>
			<DialogContent showCloseButton={false} className="p-4 sm:p-6 pt-10 sm:max-w-4xl max-h-[90vh] overflow-y-auto">
				<DialogTitle className="sr-only">Pricing Plans</DialogTitle>
				{/* Close button for mobile */}
				<button
					onClick={() => setIsOpen(false)}
					className="absolute top-2 right-2 sm:hidden z-50 p-2 bg-stone-100 rounded-full hover:bg-stone-200 touch-manipulation"
					aria-label="Close"
				>
					<X className="h-5 w-5 text-stone-700" />
				</button>
				<div>
					<PricingSection
						subscriptionTier={subscriptionTier}
						isModal={true}
						onClose={() => setIsOpen(false)}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}
