// The pairing's weakest factor (multipleRoundMatching.ts, ageGap): teams of a similar average age meet when nothing
// else decides. A team's age is the average of its players' ages on the night of the pairing.

const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;

// Age in years, with the part of the year since the last birthday (30.5 = halfway between the 30th and 31st)
export function ageInYears(birthDate: Date, today: Date): number {
  return (today.getTime() - birthDate.getTime()) / MS_PER_YEAR;
}

/**
 * The average age of the players with a birth date; null when none has one (a Google sign-up before it is asked),
 * so the team is paired by the other factors only.
 */
export function averageAge(birthDates: ReadonlyArray<Date | null | undefined>, today: Date): number | null {
  const ages = birthDates.filter((d): d is Date => d != null).map((d) => ageInYears(d, today));
  if (ages.length === 0) return null;
  return ages.reduce((sum, age) => sum + age, 0) / ages.length;
}
