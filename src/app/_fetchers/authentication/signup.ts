import {PlayerCreateInterface} from "@/app/_interfaces/player";
import {RequestResponse} from "@/app/_interfaces/requestResponse";

export async function signUp(createPlayer: PlayerCreateInterface): Promise<RequestResponse> {
  const response = await fetch("/api/signup", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(createPlayer),
  });

  const rVal: RequestResponse = {success: true};

  if (!response.ok) {
    rVal.success = false;
    rVal.errors = await response.json();
  }
  return rVal;
}
