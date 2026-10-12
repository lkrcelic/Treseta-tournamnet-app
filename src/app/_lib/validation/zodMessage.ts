import {z} from "zod";

// The first problem's message when it is one of ours (the schemas in _interfaces word them in Croatian). zod's own
// messages are English ("Expected number, received string"), so for those the caller's fallback is used instead.
export function zodMessage(error: z.ZodError, fallback: string): string {
  const issue = error.issues[0];
  if (!issue?.message) return fallback;
  const builtIn = z.defaultErrorMap(issue, {defaultError: "", data: undefined}).message;
  return issue.message === builtIn ? fallback : issue.message;
}
