import {z} from "zod";

// Profile photos of players and teams (Claude Design "Profilna slika igrača i ekipe")

// what the browser sends: the crop as a 512×512 WebP (PNG where the browser can't make WebP)
export const PHOTO_SIDE = 512;
export const PHOTO_MAX_BYTES = 512 * 1024;
// a Google account's picture, fetched for the cropper (GET /api/players/me/google-photo)
export const GOOGLE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export const PHOTO_FORMAT_ERROR = "Slika mora biti PNG, JPG ili WebP.";
export const PHOTO_SIZE_ERROR = "Slika je prevelika.";
export const PHOTO_BLOCKED_ERROR = "Admin je isključio postavljanje slike.";
export const PHOTO_REQUIRED = "Odaberi sliku.";

export const PHOTO_VISIBILITIES = ["ALL", "TEAMMATES", "ME"] as const;
export type PhotoVisibility = (typeof PHOTO_VISIBILITIES)[number];
// a team's photo is seen by all or by its own players
export const TEAM_PHOTO_VISIBILITIES = ["ALL", "TEAMMATES"] as const;
export type TeamPhotoVisibility = (typeof TEAM_PHOTO_VISIBILITIES)[number];

// PUT /api/players/[id]/photo, PUT /api/teams/[id]/photo: the image as base64 or a data: URL
export const PhotoUploadValidation = z.object({
  data: z.string({required_error: PHOTO_REQUIRED, invalid_type_error: PHOTO_REQUIRED}).min(1, PHOTO_REQUIRED),
});

// what a PUT answers: the photo's new address
export type PhotoSaved = {photo_url: string};

// The photo fields a player gets about themself (and an admin about anyone): who may see the photo, whether an admin
// has stopped new ones, and (only for the player) whether their Google account has a picture to offer
export type OwnPhoto = {
  photo_url: string | null;
  photo_visibility: PhotoVisibility;
  photo_blocked: boolean;
  has_google_photo?: boolean;
};

// The same for a team: its players and admins get them on the Team page
export type TeamPhotoInfo = {
  photo_url: string | null;
  photo_visibility: TeamPhotoVisibility;
  photo_blocked: boolean;
  // a player of the team: sets the photo and its visibility
  can_edit: boolean;
};
