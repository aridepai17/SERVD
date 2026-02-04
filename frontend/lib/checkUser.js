import { auth, currentUser } from "@clerk/nextjs/server";

const STRAPI_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

export const checkUser = async () => {
	const user = await currentUser();

	if (!user) {
		console.log("No User found");
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
		if (!primaryEmail) {
			console.error("User had no email address");
			return null;
		}

		// First, try to find user by clerkId
		const existingUserResponse = await fetch(
			`${STRAPI_URL}/api/users?filters[clerkId][$eq]=${encodeURIComponent(user.id)}`,
			{
				headers: {
					Authorization: `Bearer ${STRAPI_API_TOKEN}`,
				},
				cache: "no-store",
			},
		);

		if (!existingUserResponse.ok) {
			const errorText = await existingUserResponse.text();
			console.error("Strapi error response:", errorText);
			return null;
		}

		const existingUserData = await existingUserResponse.json();

		if (existingUserData.data && existingUserData.data.length > 0) {
			const existingUser = existingUserData.data[0];
			// Access subscriptionTier from attributes (Strapi v4)
			const existingTier = existingUser.attributes?.subscriptionTier || existingUser.subscriptionTier;

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
					console.error(
						"Failed to update subscription tier:",
						await updateResponse.text(),
					);
					return { ...existingUser.attributes, ...existingUser, id: existingUser.id, subscriptionTier };
				}
			}

			// Return user with attributes merged (Strapi v4 format)
			return { ...existingUser.attributes, ...existingUser, id: existingUser.id, subscriptionTier };
		}

		// If not found by clerkId, search by email (user might exist with different clerkId)
		const emailSearchResponse = await fetch(
			`${STRAPI_URL}/api/users?filters[email][$eq]=${encodeURIComponent(primaryEmail)}`,
			{
				headers: {
					Authorization: `Bearer ${STRAPI_API_TOKEN}`,
				},
				cache: "no-store",
			},
		);

		if (emailSearchResponse.ok) {
			const emailSearchData = await emailSearchResponse.json();
			if (emailSearchData.data && emailSearchData.data.length > 0) {
				const existingUserByEmail = emailSearchData.data[0];
				// User exists with same email but different clerkId - update the clerkId
				console.log("User found by email, updating clerkId...");
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

				if (updateResponse.ok) {
					const updatedUser = await updateResponse.json();
					return { ...updatedUser.data.attributes, ...updatedUser.data, id: updatedUser.data.id, subscriptionTier };
				}
			}
		}

		// User doesn't exist, create new one
		const rolesResponse = await fetch(
			`${STRAPI_URL}/api/users-permissions/roles`,
			{
				headers: {
					Authorization: `Bearer ${STRAPI_API_TOKEN}`,
				},
			},
		);

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
		return { ...newUser.data, subscriptionTier };
	} catch (error) {
		console.error("Error in checkUser:", error.message);
		return null;
	}
};
