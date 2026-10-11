import {responseErrorMessage} from "@/app/_fetchers/errorMessage";
import { CreateOngoingMatchRequest } from "@/app/_interfaces/match";

export async function createOngoingMatchAPI(data: CreateOngoingMatchRequest) {
    const response = await fetch('/api/ongoing-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error(await responseErrorMessage(response, "Failed to start the match"));
    }

    return response.json();
}