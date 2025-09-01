export async function logoutUser(): Promise<boolean> {
  const response = await fetch("/api/logout", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
  });

  if (!response.ok) return false;
  return true;
}
