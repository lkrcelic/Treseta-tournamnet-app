import {LoginUserInterface} from "@/app/_interfaces/login";

export async function loginUser(loginUser: LoginUserInterface): Promise<boolean> {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(loginUser),
  });

  if (!response.ok) return false;
  return true;
}
