import { ResultResponse } from "@/app/_interfaces/result";

export async function getResultByIdAPI(resultId: number): Promise<ResultResponse> {
  const response = await fetch(`/api/result/${resultId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch result: ${response.statusText}`);
  }

  return response.json();
}
