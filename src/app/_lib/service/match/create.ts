import {
  MatchCreateRequestValidation,
  MatchExtendedResponse,
  MatchCreateRequest,
  MatchExtendedResponseValidation,
} from "@/app/_interfaces/match";
import {prisma} from "@/app/_lib/prisma";

export async function createMatch(request: MatchCreateRequest): Promise<MatchExtendedResponse> {
  const validatedRequest = MatchCreateRequestValidation.parse(request);

  const match = await prisma.match.create({
    data: {
      round: {connect: {id: validatedRequest.round_id}},
      score_threshold: validatedRequest.score_threshold,
      active: validatedRequest.active,
    },
  });

  const validatedResponse = MatchExtendedResponseValidation.parse(match);

  return validatedResponse;
}
