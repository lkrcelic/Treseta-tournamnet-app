import {PlayerCreateValidation} from "@/app/_interfaces/player";
import {z} from "zod";
import {prisma} from "@/app/_lib/prisma";
import {USERNAME_TAKEN} from "@/app/_lib/validation/username";

// TODO: Move this to a more appropriate location?
export class ValidationError extends Error {
  public errors: Record<string, string>;

  constructor(errors: Record<string, string>) {
    super("Validation Error");
    this.name = "ValidationError";
    this.errors = errors;
  }
}

// Prisma only returns a single contraint violation even if there are multiple
export async function validateUniqueConstraintsPlayer(player: z.infer<typeof PlayerCreateValidation>): Promise<void> {
  const data = await prisma.player.findMany({
    where: {
      OR: [
        {username: {equals: player.username, mode: "insensitive"}},
        {email: {equals: player.email, mode: "insensitive"}},
      ],
    },
  });

  if (!data || data.length === 0) return;

  //TODO
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errors: any = {};
  if (data.find((p) => p.username.toLowerCase() === player.username.toLowerCase()))
    errors["username"] = USERNAME_TAKEN;
  if (data.find((p) => p.email.toLowerCase() === player.email.toLowerCase())) errors["email"] = "Taj email se već koristi.";

  if (Object.keys(errors).length > 0) {
    throw new ValidationError(errors);
  }
}
