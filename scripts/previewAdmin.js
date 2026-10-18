// Runs in `npm run build`, after the migrations. On a Vercel preview it makes `lkrcelic` (password `sifra`) an
// admin in the preview's own Neon branch, since Google login doesn't work on preview URLs. Elsewhere it does nothing.
// The preview's branch is injected by the Neon–Vercel integration; the stored Preview DATABASE_URL is production, so
// a preview that still points at production fails here instead of getting a known password.
const {PrismaClient} = require("@prisma/client");

const USERNAME = "lkrcelic";
// argon2 hash of "sifra" (the same as in prisma/seed.ts)
const PASSWORD_HASH = "$argon2id$v=19$m=65536,t=3,p=4$pDs5fiTYGTo0XSEt/3Cf7w$x8wFo37pR763HFqVMKupfveO0dBebHhLweI15eac8EI";
// the production database's Neon endpoint (the pooled host is ep-silent-glade-agl0wc6u-pooler)
const PRODUCTION_ENDPOINT = "ep-silent-glade-agl0wc6u";

const host = (url) => (url ?? "").replace(/^.*@/, "").replace(/[/?].*$/, "");

(async () => {
  if (process.env.VERCEL_ENV !== "preview") {
    console.log("previewAdmin: not a Vercel preview, skipped");
    return;
  }

  const hosts = [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED].map(host);
  if (hosts.some((h) => h.includes(PRODUCTION_ENDPOINT))) {
    console.error(`previewAdmin: this preview's database is production (${hosts.join(", ")}); is the Neon integration's branch missing?`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    // A branch copied from production already has the player (with Google login): give it the password too
    const admin = {password_hash: PASSWORD_HASH, player_role: "ADMIN", active: true, deleted_at: null};
    const player = await prisma.player.upsert({
      where: {username: USERNAME},
      update: admin,
      create: {
        ...admin,
        username: USERNAME,
        email: `${USERNAME}@preview.invalid`,
        first_name: "Lovro",
        last_name: "Krčelić",
        smoker_answered: true,
      },
    });
    console.log(`previewAdmin: ${USERNAME} (id ${player.id}) is an admin on ${hosts[0]}`);
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error("previewAdmin:", e);
  process.exit(1);
});
