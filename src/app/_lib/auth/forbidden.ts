// Thrown when the player is logged in but may not do this: a 403, not a 500 (apiErrors.errorResponse).
// requireAdmin and requireCan answer with a 403 before the handler runs; this is for the refusals that can only be
// found inside it, above all a tournament that isn't the organizer's (ownership.ts, refuseUnlessMine).
// What a refusal says, wherever it comes from: requireAdmin, requireCan or a ForbiddenError thrown inside a handler
export const FORBIDDEN = "Nemaš ovlasti za ovu radnju.";

export class ForbiddenError extends Error {
  constructor(message = FORBIDDEN) {
    super(message);
    this.name = "ForbiddenError";
  }
}
