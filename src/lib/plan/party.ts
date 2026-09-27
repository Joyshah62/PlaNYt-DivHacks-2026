import type { Profile } from "./types";

const words = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const number = `(\\d{1,2}|${words.join("|")})`;

/**
 * Friends, colleagues or kids coming along: who's coming is answered, even when
 * how many isn't. Not a word like "Friends" (the sitcom) in what they want to see.
 */
export function companyIn(text: string): boolean {
  return /\b(?:with|and) (?:my |our |some |a few |a couple of |\w+ of )?(?:friends|kids|children|colleagues)\b|\b(?:my|our) (?:\w+ )?(?:friends|kids|children|colleagues)\b|\bnot a couple\b/.test(text.toLowerCase());
}

/** Today's party comes from the traveler's words, never their pronouns or old trips. */
export function partyFromText(text: string): Pick<Partial<Profile>, "group" | "people"> {
  const q = text.toLowerCase();
  const explicit = new RegExp(`\\b${number}\\s+(?:people|persons|adults|of us|travelers|travellers)\\b`).exec(q)
    ?? new RegExp(`\\b(?:group|party|family) of ${number}\\b`).exec(q)
    ?? new RegExp(`\\b(?:we are|there are|we're) ${number}\\b`).exec(q);
  const count = explicit ? Number(explicit[1]) || words.indexOf(explicit[1]) + 1 : undefined;
  const companions = new RegExp(`\\b(?:with my|me and my) ${number} (?:kids|children|friends)\\b`).exec(q);
  const together = companions && !/\band (?:my|our|another)\b/.test(q.slice(companions.index + companions[0].length))
    ? (Number(companions[1]) || words.indexOf(companions[1]) + 1) + 1 : undefined;
  const total = count ?? together;
  const people = total && total <= 20 ? total : undefined;
  const alone = /\b(just me|by myself|travel(?:ing|ling)? alone|going alone|solo)\b/.test(q) && !/\bnot (?:alone|solo|just me)\b/.test(q);
  const family = /\b(?:my|our|with) (?:\w+ )?(?:kids|children)\b|\bfamily (?:of|with)\b/.test(q);
  const seniors = /\b(?:older|elderly) parents\b|\bgrandparents\b/.test(q);
  // Other people coming along, not a word like "Friends" (the sitcom) in what they want to see.
  const others = companyIn(q);
  const couple = /\b(?:my (?:wife|husband|partner)|a couple(?! of))\b/.test(q) && !others && (!people || people === 2);
  return {
    ...(family ? { group: "family" as const } : seniors ? { group: "seniors" as const } : couple ? { group: "couple" as const } : alone ? { group: "solo" as const } : {}),
    ...(people ? { people } : alone ? { people: 1 } : couple ? { people: 2 } : {}),
  };
}
