// Sponzori: production has none yet, but Početna and a live round show them, so the world has five on the current
// league (one on the black plate, one without a page, one with the longest message) and a month of statistics.
import {addDays, makePng, type Ctx} from "../context";

const SPONSORS = [
  {name: "Pivovara Kartaš", url: "https://example.com/pivovara", message: "Hladno pivo za svako zvanje", background: "none"},
  {name: "Pekara Belot", url: "https://example.com/pekara", message: "", background: "dark"},
  {name: "Auto škola Adut", url: null, message: "Polažeš iz prve ili ti je sljedeća tura na nas", background: "none"},
  {
    name: "Mesnica Štiglja",
    url: "https://example.com/mesnica",
    // 80 characters, the longest a message may be
    message: "Ćevapi, kobasice i pršut za sve ekipe koje odigraju štiglju na ligaškoj večeri!!",
    background: "none",
  },
  {name: "Kafić Zvanje", url: "https://example.com/kafic", message: "Kava 1 €", background: "dark"},
] as const;

export async function seedSponsors(ctx: Ctx, leagueId: number) {
  const rng = ctx.rng.fork("sponsors");
  for (const [position, s] of Array.from(SPONSORS.entries())) {
    const size = rng.pick([256, 384, 512]);
    const sponsor = await ctx.prisma.sponsor.create({
      data: {
        name: s.name,
        url: s.url,
        message: s.message.slice(0, 80),
        background: s.background,
        logo: makePng([rng.int(30, 220), rng.int(30, 220), rng.int(30, 220)], size),
        logo_type: "image/png",
        logo_width: size,
        logo_height: size,
      },
    });
    await ctx.prisma.leagueSponsor.create({data: {league_id: leagueId, sponsor_id: sponsor.id, position}});
    await ctx.prisma.sponsorDailyStat.createMany({
      data: Array.from({length: 30}, (_, i) => {
        const views = rng.int(20, 400);
        return {sponsor_id: sponsor.id, league_id: leagueId, day: addDays(ctx.today, -i), views, clicks: rng.int(0, Math.round(views / 15))};
      }),
    });
    ctx.catalog.sponsors[position === 1 ? "darkPlate" : position === 2 ? "noPage" : `s${position + 1}`] = {
      id: sponsor.id,
      name: sponsor.name,
    };
  }
  ctx.log(`sponsors: ${SPONSORS.length} on league ${leagueId}`);
}
