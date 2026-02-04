"use server";

import { checkUser } from "@/lib/checkUser";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { freeMealRecommendations, proTierLimit } from "@/lib/arcjet";
import { request } from "@arcjet/next";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const STRAPI_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Helper function to normalize recipe title
function normalizeTitle(title) {
	return title
		.trim()
		.split(" ")
		.map(
			(word) =>
				word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
		)
		.join(" ");
}

function maskToken(token) {
	if (!token) {
		return "missing";
	}
	const tokenString = String(token);
	const tail = tokenString.slice(-4);
	return `present(len=${tokenString.length}, tail=${tail})`;
}

async function parseErrorBody(response) {
	try {
		const contentType = response.headers.get("content-type") || "";
		if (contentType.includes("application/json")) {
			const json = await response.json();
			return JSON.stringify(json);
		}
		return await response.text();
	} catch (error) {
		return `unreadable body: ${error?.message || "unknown error"}`;
	}
}

async function throwStrapiResponseError(label, response) {
	const bodyText = await parseErrorBody(response);
	const tokenInfo = maskToken(STRAPI_API_TOKEN);
	const message = `${label} failed: ${response.status} ${response.statusText} | body=${bodyText} | token=${tokenInfo}`;
	const error = new Error(message);
	error.name = "StrapiResponseError";
	throw error;
}

async function fetchRecipeByTitle(normalizedTitle) {
	const searchResponse = await fetch(
		`${STRAPI_URL}/api/recipes?filters[title][$eqi]=${encodeURIComponent(
			normalizedTitle,
		)}&populate=*`,
		{
			headers: {
				Authorization: `Bearer ${STRAPI_API_TOKEN}`,
			},
			cache: "no-store",
		},
	);

	if (!searchResponse.ok) {
		await throwStrapiResponseError("Strapi searchResponse", searchResponse);
	}

	const searchData = await searchResponse.json();
	if (searchData.data && searchData.data.length > 0) {
		return searchData.data[0];
	}

	return null;
}

async function isRecipeSavedForUser(userId, recipeId) {
	if (!userId || !recipeId) {
		return false;
	}

	const savedRecipeResponse = await fetch(
		`${STRAPI_URL}/api/saved-recipes?filters[user][id][$eq]=${userId}&filters[recipe][id][$eq]=${recipeId}`,
		{
			headers: {
				Authorization: `Bearer ${STRAPI_API_TOKEN}`,
			},
			cache: "no-store",
		},
	);

	if (!savedRecipeResponse.ok) {
		await throwStrapiResponseError(
			"Strapi savedRecipeResponse",
			savedRecipeResponse,
		);
	}

	const savedData = await savedRecipeResponse.json();
	return savedData.data && savedData.data.length > 0;
}

// Helper function to fetch image from Unsplash
async function fetchRecipeImage(recipeName) {
	try {
		if (!UNSPLASH_ACCESS_KEY) {
			console.warn(
				"⚠️ UNSPLASH_ACCESS_KEY not set, skipping image fetch",
			);
			return "";
		}

		const searchQuery = `${recipeName}`;
		const response = await fetch(
			`https://api.unsplash.com/search/photos?query=${encodeURIComponent(
				searchQuery,
			)}&per_page=1&orientation=landscape`,
			{
				headers: {
					Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
				},
			},
		);

		if (!response.ok) {
			console.error("❌ Unsplash API error:", response.statusText);
			return "";
		}

		const data = await response.json();

		if (data.results && data.results.length > 0) {
			const photo = data.results[0];
			console.log("✅ Found Unsplash image:", photo.urls.regular);
			return photo.urls.regular;
		}

		console.log("ℹ️ No Unsplash image found for:", recipeName);
		return "";
	} catch (error) {
		console.error("❌ Error fetching Unsplash image:", error);
		return "";
	}
}

// Get or generate recipe details
export async function getOrGenerateRecipe(formData) {
	try {
		const user = await checkUser();
		if (!user) {
			throw new Error("User not authenticated");
		}

		const recipeName = formData.get("recipeName");
		if (!recipeName) {
			throw new Error("Recipe name is required");
		}

		// Normalize the title (e.g., "apple cake" → "Apple Cake")
		const normalizedTitle = normalizeTitle(recipeName);
		console.log("🔍 Searching for recipe:", normalizedTitle);

		const isPro = user.subscriptionTier === "pro";

		// Step 1: Check if recipe already exists in DB (case-insensitive search)
		const existingRecipe = await fetchRecipeByTitle(normalizedTitle);
		if (existingRecipe) {
			let normalizedRecipe = existingRecipe.attributes
				? { id: existingRecipe.id, ...existingRecipe.attributes }
				: existingRecipe;
			// Normalize ImageUrl to imageUrl for frontend compatibility
			if (normalizedRecipe.ImageUrl && !normalizedRecipe.imageUrl) {
				normalizedRecipe = {
					...normalizedRecipe,
					imageUrl: normalizedRecipe.ImageUrl,
				};
				delete normalizedRecipe.ImageUrl;
			}
			const recipeId = normalizedRecipe.id ?? existingRecipe.id;
			console.log("✅ Recipe found in database:", existingRecipe.id);

			const isSaved = await isRecipeSavedForUser(user.id, recipeId);

			return {
				success: true,
				recipe: normalizedRecipe,
				recipeId: normalizedRecipe.id ?? existingRecipe.id,
				isSaved,
				fromDatabase: true,
				isPro,
				message: "Recipe loaded from database",
			};
		}

		// Step 2: Recipe doesn't exist, generate with Gemini
		console.log("🤖 Recipe not found, generating with Gemini...");

		const model = genAI.getGenerativeModel({
			model: "gemini-2.5-flash",
		});

		const prompt = `
You are a professional chef and recipe expert. Generate a detailed recipe for: "${normalizedTitle}"

CRITICAL: The "title" field MUST be EXACTLY: "${normalizedTitle}" (no changes, no additions like "Classic" or "Easy")

Return ONLY a valid JSON object with this exact structure (no markdown, no explanations):
{
    "title": "${normalizedTitle}",
    "description": "Brief 2-3 sentence description of the dish",
    "category": "Must be ONE of these EXACT values: breakfast, lunch, dinner, snack, dessert",
    "cuisine": "Must be ONE of these EXACT values: italian, chinese, mexican, indian, american, thai, japanese, mediterranean, french, korean, vietnamese, spanish, greek, turkish, moroccan, brazilian, caribbean, middle - eastern, british, german, portuguese, other",
    "prepTime": "Time in minutes (number only)",
    "cookTime": "Time in minutes (number only)",
    "servings": "Number of servings (number only)",
    "ingredients": [
        {
        "item": "ingredient name",
        "amount": "quantity with unit",
        "category": "Protein|Vegetable|Spice|Dairy|Grain|Other"
        }
    ],
    "instructions": [
        {
        "step": 1,
        "title": "Brief step title",
        "instruction": "Detailed step instruction",
        "tip": "Optional cooking tip for this step"
        }
    ],
    "nutrition": {
        "calories": "calories per serving",
        "protein": "grams",
        "carbs": "grams",
        "fat": "grams"
    },
    "tips": [
        "General cooking tip 1",
        "General cooking tip 2",
        "General cooking tip 3"
    ],
    "substitutions": [
        {
        "original": "ingredient name",
        "alternatives": ["substitute 1", "substitute 2"]
        }
    ]
}

IMPORTANT RULES FOR CATEGORY:
- Breakfast items (pancakes, eggs, cereal, etc.) → "breakfast"
- Main meals for midday (sandwiches, salads, pasta, etc.) → "lunch"
- Main meals for evening (heavier dishes, roasts, etc.) → "dinner"
- Light items between meals (chips, crackers, fruit, etc.) → "snack"
- Sweet treats (cakes, cookies, ice cream, etc.) → "dessert"

IMPORTANT RULES FOR CUISINE:
- Use lowercase only
- Pick the closest match from the allowed values
- If uncertain, use "other"

Guidelines:
- Make ingredients realistic and commonly available
- Instructions should be clear and beginner-friendly
- Include 6-10 detailed steps
- Provide practical cooking tips
- Estimate realistic cooking times
- Keep total instructions under 12 steps
`;

		const result = await model.generateContent(prompt);
		const response = await result.response;
		const text = response.text();

		// Parse JSON response
		let recipeData;
		try {
			const cleanText = text
				.replace(/```json\n?/g, "")
				.replace(/```\n?/g, "")
				.trim();
			recipeData = JSON.parse(cleanText);
		} catch (parseError) {
			console.error("Failed to parse Gemini response:", text);
			throw new Error("Failed to generate recipe. Please try again.");
		}

		// FORCE the title to be our normalized version
		recipeData.title = normalizedTitle;

		// Validate and sanitize category
		const validCategories = [
			"breakfast",
			"lunch",
			"dinner",
			"snack",
			"dessert",
		];
		const category = validCategories.includes(
			recipeData.category?.toLowerCase(),
		)
			? recipeData.category.toLowerCase()
			: "dinner";

		// Validate and sanitize cuisine
		const validCuisines = [
			"italian",
			"chinese",
			"mexican",
			"indian",
			"japanese",
			"thai",
			"french",
			"mediterranean",
			"greek",
			"spanish",
			"american",
			"middle - eastern",
			"vietnamese",
			"korean",
			"caribbean",
			"german",
			"british",
			"african",
			"latin-american",
			"portuguese",
			"other",
		];
		const cuisine = validCuisines.includes(
			recipeData.cuisine?.toLowerCase(),
		)
			? recipeData.cuisine.toLowerCase()
			: "other";

		// Step 3: Fetch image from Unsplash
		console.log("🖼️ Fetching image from Unsplash...");
		let imageUrl = await fetchRecipeImage(normalizedTitle);
		if (!imageUrl) {
			console.log("⚠️ No image found, using placeholder.");
			imageUrl = "https://placehold.co/1200x600/E97401/FFFFFF/png?text=Recipe";
		}

		// Step 4: Save generated recipe to database
		const strapiRecipeData = {
			data: {
				title: normalizedTitle,
				description: recipeData.description,
				cuisine,
				category,
				ingredients: recipeData.ingredients,
				instructions: recipeData.instructions,
				prepTime: Number(recipeData.prepTime),
				cookTime: Number(recipeData.cookTime),
				servings: Number(recipeData.servings),
				nutrition: recipeData.nutrition,
				tips: recipeData.tips,
				substitutions: recipeData.substitutions,
				ImageUrl: imageUrl,
				isPublic: true,
				author: user.id,
			},
		};

		console.log(
			"📤 Saving new recipe to database with title:",
			normalizedTitle,
		);

		const createRecipeResponse = await fetch(`${STRAPI_URL}/api/recipes`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${STRAPI_API_TOKEN}`,
			},
			body: JSON.stringify(strapiRecipeData),
		});

		if (!createRecipeResponse.ok) {
			if (createRecipeResponse.status === 409) {
				console.warn(
					"⚠️ Recipe already exists, fetching existing record:",
					normalizedTitle,
				);
				const existingRecipe =
					await fetchRecipeByTitle(normalizedTitle);
				if (existingRecipe) {
					let normalizedRecipe = existingRecipe.attributes
						? {
								id: existingRecipe.id,
								...existingRecipe.attributes,
							}
						: existingRecipe;
					// Normalize ImageUrl to imageUrl for frontend compatibility
					if (normalizedRecipe.ImageUrl && !normalizedRecipe.imageUrl) {
						normalizedRecipe = {
							...normalizedRecipe,
							imageUrl: normalizedRecipe.ImageUrl,
						};
						delete normalizedRecipe.ImageUrl;
					}
					const isSaved = await isRecipeSavedForUser(
						user.id,
						normalizedRecipe.id ?? existingRecipe.id,
					);
					return {
						success: true,
						recipe: normalizedRecipe,
						recipeId: normalizedRecipe.id ?? existingRecipe.id,
						isSaved,
						fromDatabase: true,
						isPro,
						message: "Recipe already existed; loaded from database",
					};
				}
				throw new Error(
					"Recipe already exists but could not be fetched",
				);
			}
			const errorText = await createRecipeResponse.text();
			console.error("❌ Failed to save recipe:", errorText);
			throw new Error("Failed to save recipe to database");
		}

		const createdRecipe = await createRecipeResponse.json();
		console.log("✅ Recipe saved to database:", createdRecipe.data.id);

		return {
			success: true,
			recipe: {
				...recipeData,
				title: normalizedTitle,
				category,
				cuisine,
				imageUrl: imageUrl || "",
			},
			recipeId: createdRecipe.data.id,
			isSaved: false,
			fromDatabase: false,
			recommendationsLimit: isPro ? "unlimited" : 5,
			isPro,
			message: "Recipe generated and saved successfully!",
		};
	} catch (error) {
		console.error("❌ Error in getOrGenerateRecipe:", error);
		throw new Error(error.message || "Failed to load recipe");
	}
}

// Save recipe to user's collection (bookmark)
export async function saveRecipeToCollection(formData) {
	try {
		const user = await checkUser();
		if (!user) {
			throw new Error("User not authenticated");
		}

		const recipeId = formData.get("recipeId");
		if (!recipeId) {
			throw new Error("Recipe ID is required");
		}

		// Check if already saved
		const existingResponse = await fetch(
			`${STRAPI_URL}/api/saved-recipes?filters[user][id][$eq]=${user.id}&filters[recipe][id][$eq]=${recipeId}`,
			{
				headers: {
					Authorization: `Bearer ${STRAPI_API_TOKEN}`,
				},
				cache: "no-store",
			},
		);

		if (!existingResponse.ok) {
			await throwStrapiResponseError(
				"Check existing saved recipe",
				existingResponse,
			);
		}
		{
			const existingData = await existingResponse.json();
			if (existingData.data && existingData.data.length > 0) {
				return {
					success: true,
					alreadySaved: true,
					message: "Recipe is already in your collection",
				};
			}
		}

		// Create saved recipe relation
		const saveResponse = await fetch(`${STRAPI_URL}/api/saved-recipes`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${STRAPI_API_TOKEN}`,
			},
			body: JSON.stringify({
				data: {
					user: user.id,
					recipe: recipeId,
					savedAt: new Date().toISOString(),
				},
			}),
		});

		if (!saveResponse.ok) {
			const errorText = await saveResponse.text();
			console.error("❌ Failed to save recipe to collection:", errorText);
			throw new Error("Failed to save recipe to collection");
		}

		const savedRecipe = await saveResponse.json();
		console.log("✅ Recipe saved to collection:", savedRecipe.data.id);

		return {
			success: true,
			message: "Recipe saved to your collection!",
		};
	} catch (error) {
		console.error("❌ Error in saveRecipeToCollection:", error);
		throw new Error(error.message || "Failed to save recipe to collection");
	}
}

// Remove recipe from user's collection (bookmark)
export async function removeRecipeFromCollection(formData) {
	try {
		const user = await checkUser();
		if (!user) {
			throw new Error("User not authenticated");
		}

		const recipeId = formData.get("recipeId");
		if (!recipeId) {
			throw new Error("Recipe ID is required");
		}

		// Find the saved recipe entry
		const savedRecipeResponse = await fetch(
			`${STRAPI_URL}/api/saved-recipes?filters[user][id][$eq]=${user.id}&filters[recipe][id][$eq]=${recipeId}`,
			{
				headers: {
					Authorization: `Bearer ${STRAPI_API_TOKEN}`,
				},
				cache: "no-store",
			},
		);

		if (!savedRecipeResponse.ok) {
			await throwStrapiResponseError(
				"Find saved recipe for removal",
				savedRecipeResponse,
			);
		}

		const savedRecipeData = await savedRecipeResponse.json();
		if (!savedRecipeData.data || savedRecipeData.data.length === 0) {
			throw new Error("Recipe not found in your collection");
		}

		const savedRecipeEntryId = savedRecipeData.data[0].id;

		// Delete the saved recipe entry
		const deleteResponse = await fetch(
			`${STRAPI_URL}/api/saved-recipes/${savedRecipeEntryId}`,
			{
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${STRAPI_API_TOKEN}`,
				},
			},
		);

		if (!deleteResponse.ok) {
			const errorText = await deleteResponse.text();
			console.error("❌ Failed to remove recipe:", errorText);
			throw new Error("Failed to remove recipe from collection");
		}

		console.log("✅ Recipe removed from collection:", recipeId);

		return {
			success: true,
			message: "Recipe removed from your collection",
		};
	} catch (error) {
		console.error("❌ Error in removeRecipeFromCollection:", error);
		throw new Error(
			error.message || "Failed to remove recipe from collection",
		);
	}
}

// Get all saved recipes for the current user
export async function getSavedRecipes() {
	try {
		const user = await checkUser();
		if (!user) {
			throw new Error("User not authenticated");
		}

		const savedRecipesResponse = await fetch(
			`${STRAPI_URL}/api/saved-recipes?filters[user][id][$eq]=${user.id}&populate=recipe&sort=savedAt:desc`,
			{
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${STRAPI_API_TOKEN}`,
				},
				cache: "no-store",
			},
		);

		if (!savedRecipesResponse.ok) {
			await throwStrapiResponseError(
				"Fetch saved recipes",
				savedRecipesResponse,
			);
		}

		const savedRecipesData = await savedRecipesResponse.json();
		const recipes = (savedRecipesData.data || []).map((item) => {
			const recipeData = item.attributes?.recipe?.data;
			if (recipeData) {
				const attrs = recipeData.attributes;
				// Normalize ImageUrl to imageUrl for frontend compatibility
				let normalizedAttrs = {
					...attrs,
				};
				if (attrs.ImageUrl && !attrs.imageUrl) {
					normalizedAttrs = {
						...normalizedAttrs,
						imageUrl: attrs.ImageUrl,
					};
					delete normalizedAttrs.ImageUrl;
				}
				return {
					id: recipeData.id,
					...normalizedAttrs,
				};
			}
			return null;
		}).filter(Boolean);

		return {
			success: true,
			recipes,
		};
	} catch (error) {
		console.error("❌ Error in getSavedRecipes:", error);
		throw new Error(error.message || "Failed to fetch saved recipes");
	}
}

// Get recipe suggestions based on pantry ingredients
export async function getRecipesByPantryIngredients() {
	try {
		const user = await checkUser();
		if (!user) {
			throw new Error("User not authenticated");
		}

		// Get user's pantry items
		const pantryResponse = await fetch(
			`${STRAPI_URL}/api/pantry-items?filters[owner][id][$eq]=${user.id}`,
			{
				headers: {
				Authorization: `Bearer ${STRAPI_API_TOKEN}`,
			},
				cache: "no-store",
			},
		);

		if (!pantryResponse.ok) {
			throw new Error("Failed to fetch pantry items");
		}

		const pantryData = await pantryResponse.json();
		const pantryItems = pantryData.data || [];

		if (pantryItems.length === 0) {
			return {
				success: false,
				message: "Your pantry is empty. Add ingredients first!",
			};
		}

		// Extract ingredient names
		const ingredients = pantryItems.map(
			(item) => `${item.attributes?.name} (${item.attributes?.quantity})`,
		);
		const ingredientsUsed = ingredients.join(", ");

		// Check if user is Pro for recommendations limit
		const isPro = user.subscriptionTier === "pro";

		// Generate recipe suggestions using Gemini
		const model = genAI.getGenerativeModel({
			model: "gemini-2.5-flash",
		});

		const prompt = `
You are a professional chef and recipe expert. Based on these pantry ingredients: ${ingredientsUsed}

Generate 3-5 recipe suggestions that can be made with these ingredients.

Return ONLY a valid JSON array with this exact structure (no markdown, no explanations):
[
    {
        "title": "Recipe Name",
        "description": "Brief 2-3 sentence description",
        "category": "breakfast|lunch|dinner|snack|dessert",
        "cuisine": "italian|chinese|mexican|indian|american|thai|japanese|mediterranean|french|other",
        "matchPercentage": 85,
        "matchedIngredients": ["ingredient1", "ingredient2"],
        "missingIngredients": ["ingredient3"]
    }
]

Rules:
- Prioritize recipes that use most of the available ingredients
- If some ingredients are missing, suggest simple substitutions or note them
- Keep match percentage realistic (60-100)
- Return 3-5 recipes max
`;

		const result = await model.generateContent(prompt);
		const response = await result.response;
		const text = response.text();

		// Parse JSON response
		let recipes;
		try {
			const cleanText = text
				.replace(/```json\n?/g, "")
				.replace(/```\n?/g, "")
				.trim();
			recipes = JSON.parse(cleanText);
		} catch (parseError) {
			console.error("Failed to parse Gemini response:", text);
			throw new Error("Failed to generate recipe suggestions");
		}

		return {
			success: true,
			recipes,
			ingredientsUsed,
			recommendationsLimit: isPro ? "unlimited" : 5,
		};
	} catch (error) {
		console.error("❌ Error in getRecipesByPantryIngredients:", error);
		throw new Error(error.message || "Failed to get recipe suggestions");
	}
}
