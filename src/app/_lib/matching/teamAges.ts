// The pairing's weakest factor (multipleRoundMatching.ts, ageGap): teams of a similar average age meet when nothing
// else decides. A team's age is the average of its players' ages on the night of the pairing.

const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;
// a player without a birth date (a Google sign-up before it is asked) counts as this old
export const DEFAULT_AGE = 24;
// a birth date that makes a player younger than this is taken as not entered (a slip such as today's date) and counts
// as DEFAULT_AGE
export const MIN_AGE = 18;

// Age in years, with the part of the year since the last birthday (30.5 = halfway between the 30th and 31st)
export function ageInYears(birthDate: Date, today: Date): number {
  return (today.getTime() - birthDate.getTime()) / MS_PER_YEAR;
}

/**
 * The average age of the players, one without a birth date or younger than MIN_AGE counting as DEFAULT_AGE; null for a team without
 * players, which is then paired by the other factors only.
 */
export function averageAge(birthDates: ReadonlyArray<Date | null | undefined>, today: Date): number | null {
  const ages = birthDates.map((d) => {
    const age = d != null ? ageInYears(d, today) : null;
    return age != null && age >= MIN_AGE ? age : DEFAULT_AGE;
  });
  if (ages.length === 0) return null;
  return ages.reduce((sum, age) => sum + age, 0) / ages.length;
}
