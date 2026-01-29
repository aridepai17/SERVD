"use client";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import React, { useState } from "react";
import PricingSection from "./PricingSection";

export default function PricingModal({ subscriptionTier = "free", children }) {
	const [isOpen, setIsOpen] = useState(false);
	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				{children}
			</DialogTrigger>
			<DialogContent className="p-8 pt-4 sm:max-w-4xl">
				<DialogTitle className="sr-only">Pricing Plans</DialogTitle>
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
