import { ResultResponse } from "@/app/_interfaces/result";

type UpdateResultByIdAPIProps = {
  resultId: string | string[];
  result: ResultResponse;
};

export async function updateResultByIdAPI({
  resultId,
  result,
}: UpdateResultByIdAPIProps): Promise<ResultResponse> {
  const response = await fetch(`/api/result/${resultId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({...result}),
  });

  if (!response.ok) {
    throw new Error(`Failed to update result: ${response.statusText}`);
  }

  return response.json();
}
