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
		console.error("STRAPI_API_TOKEN is missing");
		return null;
	}

	const { has } = await auth();
	const subscriptionTier = has({ plan: "pro" }) ? "pro" : "free";

	try {
		const primaryEmail = user.emailAddresses?.[0]?.emailAddress;
		console.log("checkUser:", { clerkId: user.id, email: primaryEmail, tier: subscriptionTier });
		
		if (!primaryEmail) {
			console.error("No email");
			return null;
		}

		// Search by clerkId
		const clerkIdUrl = `${STRAPI_URL}/api/users?filters[clerkId][$eq]=${encodeURIComponent(user.id)}`;
		const clerkIdResponse = await fetch(clerkIdUrl, {
			headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
			cache: "no-store",
		});

		if (clerkIdResponse.ok) {
			const data = await clerkIdResponse.json();
			if (data.data && data.data.length > 0) {
				const foundUser = data.data[0];
				console.log("Found by clerkId:", foundUser.id);
				return { 
					...foundUser.attributes, 
					...foundUser, 
					id: foundUser.id, 
					subscriptionTier 
				};
			}
		}

		// Search by email (case-insensitive)
		const emailUrl = `${STRAPI_URL}/api/users?filters[email][$eqi]=${encodeURIComponent(primaryEmail)}`;
		const emailResponse = await fetch(emailUrl, {
			headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
			cache: "no-store",
		});

		if (emailResponse.ok) {
			const emailData = await emailResponse.json();
			if (emailData.data && emailData.data.length > 0) {
				const userByEmail = emailData.data[0];
				console.log("Found by email:", userByEmail.id, "updating clerkId...");
				
				// Update clerkId for existing user
				const updateResponse = await fetch(
					`${STRAPI_URL}/api/users/${userByEmail.id}`,
					{
						method: "PUT",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${STRAPI_API_TOKEN}` },
						body: JSON.stringify({ clerkId: user.id, subscriptionTier }),
					},
				);

				if (updateResponse.ok) {
					const updated = await updateResponse.json();
					console.log("Updated clerkId successfully");
					return { ...updated.data.attributes, ...updated.data, id: updated.data.id, subscriptionTier };
				} else {
					console.log("Update failed, returning existing user");
					return { ...userByEmail.attributes, ...userByEmail, id: userByEmail.id, subscriptionTier };
				}
			}
		}

		// Get authenticated role
		const rolesResponse = await fetch(
			`${STRAPI_URL}/api/users-permissions/roles`,
			{ headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` } },
		);

		if (!rolesResponse.ok) {
			console.error("Failed to fetch roles");
			return null;
		}

		const rolesData = await rolesResponse.json();
		const roles = rolesData.data || rolesData.roles || [];
		const authenticatedRole = roles.find((r) => r.type === "authenticated");

		if (!authenticatedRole) {
			console.error("No authenticated role");
			return null;
		}

		// Create new user
		const userData = {
			username: user.username || primaryEmail.split("@")[0],
			email: primaryEmail,
			password: `clerk_${user.id}_${Date.now()}`,
			confirmed: true,
			blocked: false,
			role: authenticatedRole.id,
			clerkId: user.id,
			firstName: user.firstName || "",
			lastName: user.lastName || "",
			ImageUrl: user.imageUrl || "",
			subscriptionTier,
		};

		console.log("Creating new user...");
		const createResponse = await fetch(`${STRAPI_URL}/api/users`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${STRAPI_API_TOKEN}` },
			body: JSON.stringify(userData),
		});

		if (!createResponse.ok) {
			const err = await createResponse.text();
			console.error("Create failed:", err);
			// Try one more time to fetch user by email (they might already exist)
			const fallbackResponse = await fetch(emailUrl, {
				headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
			});
			if (fallbackResponse.ok) {
				const fallbackData = await fallbackResponse.json();
				if (fallbackData.data && fallbackData.data.length > 0) {
					const fallbackUser = fallbackData.data[0];
					console.log("Found existing user on fallback, returning:", fallbackUser.id);
					// Update their clerkId
					await fetch(
						`${STRAPI_URL}/api/users/${fallbackUser.id}`,
						{
							method: "PUT",
							headers: { "Content-Type": "application/json", Authorization: `Bearer ${STRAPI_API_TOKEN}` },
							body: JSON.stringify({ clerkId: user.id, subscriptionTier }),
						},
					);
					return { ...fallbackUser.attributes, ...fallbackUser, id: fallbackUser.id, subscriptionTier };
				}
			}
			// User exists in Clerk but not properly linked - try to get by clerkId again
			const retryClerkIdResponse = await fetch(clerkIdUrl, {
				headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
			});
			if (retryClerkIdResponse.ok) {
				const retryData = await retryClerkIdResponse.json();
				if (retryData.data && retryData.data.length > 0) {
					const retryUser = retryData.data[0];
					console.log("Found on retry by clerkId:", retryUser.id);
					return { ...retryUser.attributes, ...retryUser, id: retryUser.id, subscriptionTier };
				}
			}
			return null;
		}

		const newUser = await createResponse.json();
		console.log("Created new user:", newUser.data?.id);
		return { ...newUser.data, subscriptionTier };
	} catch (error) {
		console.error("checkUser error:", error.message);
		return null;
	}
};
