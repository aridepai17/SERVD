import {
	SignedIn,
	SignInButton,
	SignUpButton,
	UserButton,
} from "@clerk/nextjs";
import { Button } from "./ui/button";
import Link from "next/link";
import { Cookie, Refrigerator } from "lucide-react";
import UserDropdown from "./UserDropdown";

const Header = async () => {
	const user = null;
	return (
		<header className="fixed top-0 w-full border-b border-stone-200 bg-stone-50/80 backdrop-blur-md z-50 supports-backdrop-filter:bg-stone-50/60">
			<nav className="container mx-auto px-4 h-16 flex items-center justify-between">
				<Link href={user ? "/dashboard" : "/"}>
					<Image
						src="/orange-logo.png"
						alt="Servd Logo"
						width={60}
						height={60}
						className="w-16"
					/>
				</Link>
				<div className="hideend md:flex items-center space-x-8 text-sm font-medium text-stone-600">
					<Link
						href="/recipes"
						className="hover:text-orange-600 transition-colors flex gap-1.5 items-center"
					>
						<Cookie className="w-4 h-4" />
						My Recipes
					</Link>
					<Link
						href="/pantry"
						className="hover:text-orange-600 transition-colors flex gap-1.5 items-center"
					>
						<Refrigerator className="w-4 h-4" />
						My Pantry
					</Link>
				</div>
				<div className="flex Items-center space-x-4">
					<SignedIn>
						<UserDropdown />
					</SignedIn>

					<SignedOut>
						<SignInButton mode="modal">
							<Button
								variant="ghost"
								className="text-stone-600 hover:text-text-orange-600 hover:bg-orange-50 font-medium"
							>
								Sign In
							</Button>
						</SignInButton>
						<SignUpButton mode="modal">
							<Button
								variant="primary"
								className="rouonded-full px-6"
							>
								Get Started
							</Button>
						</SignUpButton>
					</SignedOut>
				</div>
			</nav>
		</header>
	);
};

export default Header;
