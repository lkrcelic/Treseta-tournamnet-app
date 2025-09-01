import {z} from "zod";

export const LoginUser = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type LoginUserInterface = z.infer<typeof LoginUser>;
