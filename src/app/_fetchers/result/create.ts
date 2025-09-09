import { ResultResponse} from "@/app/_interfaces/result";


export async function createResultAPI(result: ResultResponse): Promise<ResultResponse> {
    const response = await fetch(`/api/result/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({...result}),
    });

    if (!response.ok) {
        throw new Error(`Failed to create result: ${response.statusText}`);
    }

    return response.json();
}