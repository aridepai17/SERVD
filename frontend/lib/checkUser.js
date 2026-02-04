import { auth, currentUser } from "@clerk/nextjs/server";

const STRAPI_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

export const checkUser = async () => {
	const user = await currentUser();

	if (!user) {
		console.log("No User found in Clerk");
		return null;
	}

	if (!STRAPI_API_TOKEN) {
		console.error("STRAPI_API_TOKEN is missing in .env.local");
		return null;
	}

	const { has } = await auth();
	const subscriptionTier = has({ plan: "pro" }) ? "pro" : "free";

	try {
		const primaryEmail = user.emailAddresses?.[0]?.emailAddress;
		console.log("checkUser called:", { clerkId: user.id, email: primaryEmail, tier: subscriptionTier });
		
		if (!primaryEmail) {
			console.error("User had no email address");
			return null;
		}

		// First, try to find user by clerkId
		const clerkIdUrl = `${STRAPI_URL}/api/users?filters[clerkId][$eq]=${encodeURIComponent(user.id)}`;
		console.log("Searching by clerkId:", clerkIdUrl);
		
		const existingUserResponse = await fetch(clerkIdUrl, {
			headers: {
				Authorization: `Bearer ${STRAPI_API_TOKEN}`,
			},
			cache: "no-store",
		});

		console.log("clerkId search response status:", existingUserResponse.status);

		if (!existingUserResponse.ok) {
			const errorText = await existingUserResponse.text();
			console.error("Strapi clerkId search error:", errorText);
			return null;
		}

		const existingUserData = await existingUserResponse.json();
		console.log("clerkId search result:", JSON.stringify(existingUserData).substring(0, 200));

		if (existingUserData.data && existingUserData.data.length > 0) {
			const existingUser = existingUserData.data[0];
			console.log("Found user by clerkId:", existingUser.id);
			
			// Access subscriptionTier from attributes (Strapi v4)
			const existingTier = existingUser.attributes?.subscriptionTier || existingUser.subscriptionTier;
			console.log("Existing tier:", existingTier, "New tier:", subscriptionTier);

			if (existingTier !== subscriptionTier) {
				const updateResponse = await fetch(
					`${STRAPI_URL}/api/users/${existingUser.id}`,
					{
						method: "PUT",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${STRAPI_API_TOKEN}`,
						},
						body: JSON.stringify({ subscriptionTier }),
					},
				);
				if (!updateResponse.ok) {
					console.error("Failed to update subscription tier:", await updateResponse.text());
					return { ...existingUser.attributes, ...existingUser, id: existingUser.id, subscriptionTier };
				}
			}

			// Return user with attributes merged (Strapi v4 format)
			return { ...existingUser.attributes, ...existingUser, id: existingUser.id, subscriptionTier };
		}

		console.log("User not found by clerkId, searching by email (case-insensitive)...");

		// If not found by clerkId, search by email (case-insensitive)
		const emailUrl = `${STRAPI_URL}/api/users?filters[email][$eqi]=${encodeURIComponent(primaryEmail)}`;
		console.log("Searching by email:", emailUrl);
		
		const emailSearchResponse = await fetch(emailUrl, {
			headers: {
				Authorization: `Bearer ${STRAPI_API_TOKEN}`,
			},
			cache: "no-store",
		});

		console.log("email search response status:", emailSearchResponse.status);

		if (!emailSearchResponse.ok) {
			console.error("Email search failed:", await emailSearchResponse.text());
		} else {
			const emailSearchData = await emailSearchResponse.json();
			console.log("email search result:", JSON.stringify(emailSearchData).substring(0, 200));
			
			if (emailSearchData.data && emailSearchData.data.length > 0) {
				const existingUserByEmail = emailSearchData.data[0];
				console.log("Found user by email:", existingUserByEmail.id, "clerkId:", existingUserByEmail.clerkId);
				
				// User exists with same email - try to update the clerkId
				console.log("Updating clerkId for existing user...");
				
				const updateResponse = await fetch(
					`${STRAPI_URL}/api/users/${existingUserByEmail.id}`,
					{
						method: "PUT",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${STRAPI_API_TOKEN}`,
						},
						body: JSON.stringify({ 
							clerkId: user.id,
							subscriptionTier,
						}),
					},
				);

				console.log("update response status:", updateResponse.status);

				if (updateResponse.ok) {
					const updatedUser = await updateResponse.json();
					console.log("Successfully updated clerkId");
					return { ...updatedUser.data.attributes, ...updatedUser.data, id: updatedUser.data.id, subscriptionTier };
				} else {
					const errorText = await updateResponse.text();
					console.error("Failed to update clerkId:", errorText);
					// If update fails, return the existing user anyway
					return { ...existingUserByEmail.attributes, ...existingUserByEmail, id: existingUserByEmail.id, subscriptionTier };
				}
			}
		}

		console.log("User not found by email either, creating new user...");

		// User doesn't exist, create new one
		const rolesResponse = await fetch(
			`${STRAPI_URL}/api/users-permissions/roles`,
			{
				headers: {
					Authorization: `Bearer ${STRAPI_API_TOKEN}`,
				},
			},
		);

		console.log("roles response status:", rolesResponse.status);

		if (!rolesResponse.ok) {
			console.error("Failed to fetch roles:", await rolesResponse.text());
			return null;
		}

		const rolesData = await rolesResponse.json();
		// Strapi v4 wraps roles in a data property
		const roles = rolesData.data || rolesData.roles || [];
		if (!roles || roles.length === 0) {
			console.error("No roles found in response");
			return null;
		}
		const authenticatedRole = roles.find(
			(role) => role.type === "authenticated",
		);

		if (!authenticatedRole) {
			console.error("Authenticated role not found");
			return null;
		}

		const userData = {
			username: user.username || primaryEmail.split("@")[0],
			email: primaryEmail,
			password: `clerk_managed_${user.id}_${Date.now()}`,
			confirmed: true,
			blocked: false,
			role: authenticatedRole.id,
			clerkId: user.id,
			firstName: user.firstName || "",
			lastName: user.lastName || "",
			ImageUrl: user.imageUrl || "",
			subscriptionTier,
		};

		console.log("Creating new user with email:", primaryEmail);

		const newUserResponse = await fetch(`${STRAPI_URL}/api/users`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${STRAPI_API_TOKEN}`,
			},
			body: JSON.stringify(userData),
		});

		if (!newUserResponse.ok) {
			const errorText = await newUserResponse.text();
			console.error("Error creating user in Strapi:", errorText);
			return null;
		}

		const newUser = await newUserResponse.json();
		console.log("New user created:", newUser.data?.id);
		return { ...newUser.data, subscriptionTier };
	} catch (error) {
		console.error("Error in checkUser:", error.message, error.stack);
		return null;
	}
};
