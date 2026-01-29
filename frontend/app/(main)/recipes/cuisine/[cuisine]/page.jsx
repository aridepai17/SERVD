"use client";

import { useParams } from "next/navigation";
import RecipeGrid from "@/components/RecipeGrid";
import { getMealsByArea } from "@/actions/mealdb.actions";

export default function CuisineRecipesPage() {
	const params = useParams();
	const cuisine = decodeURIComponent(params.cuisine ?? "").replace(/-/g, " ");

	return (
		<RecipeGrid
			type="cuisine"
			value={cuisine}
			fetchAction={getMealsByArea}
			backLink="/dashboard"
		/>
	);
}
