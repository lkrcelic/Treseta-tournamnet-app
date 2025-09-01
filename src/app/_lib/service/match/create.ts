import { CreateMatchRequestValidation, MatchExtendedResponse, CreateMatchRequest } from "@/app/_interfaces/match";
import { prisma } from "@/app/_lib/prisma";

export async function createMatch(request: CreateMatchRequest): Promise<MatchExtendedResponse> {

  const validatedRequest = CreateMatchRequestValidation.parse(request);

  const match = await prisma.match.create({data: validatedRequest});

  return match;
}
