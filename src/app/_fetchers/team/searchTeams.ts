import {apiFetch, responseErrorMessage} from "@/app/_fetchers/errorMessage";
import { TeamExtendedResponseValidation } from "@/app/_interfaces/team";

export async function searchTeamsAPI(query: string) {
  const url = new URL(`/api/teams`, window.location.origin);
  if (query) url.searchParams.set("search", query);

  const res = await apiFetch(url.toString());
  if (!res.ok) {
    throw new Error(await responseErrorMessage(res, "Pretraga ekipa nije uspjela."));
  }
  const json = await res.json();
  return TeamExtendedResponseValidation.array().parse(json);
}
