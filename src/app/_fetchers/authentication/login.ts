import {LoginUserInterface} from "@/app/_interfaces/login";

export type LoginOutcome = "ok" | "wrong" | "locked" | "error";

export async function loginUser(loginUser: LoginUserInterface): Promise<LoginOutcome> {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(loginUser),
  });

  if (response.ok) return "ok";
  if (response.status === 429) return "locked";
  // the route answers 404 for an unknown user or a wrong password
  if (response.status === 404 || response.status === 400) return "wrong";
  return "error";
}
