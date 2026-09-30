/**
 * Connected Google Form response sheets.
 *
 * Add another form by appending an entry. The sheet can stay private: an
 * approved staff member connects Google once (spreadsheet read access), and
 * every page that uses FormResponseDetail reads live rows from here.
 */
export type ConnectedForm = {
  id: string;
  title: string;
  description: string;
  spreadsheetId: string;
  gid: string;
  /** Column whose value attaches a response to a resident. */
  matchHeader: string;
  matchOn: "room" | "email";
  timestampHeader?: string;
  submitterHeader?: string;
  /** Shown under the response title, not repeated in the body. */
  summaryHeaders?: string[];
  selfiePattern?: RegExp;
  confirmationPattern?: RegExp;
  /** First matching group wins. Columns that match nothing land in More. */
  groups?: { title: string; pattern: RegExp }[];
};

export const connectedForms: ConnectedForm[] = [
  {
    id: "roommate-agreement",
    title: "Roommate agreement",
    description: "One submission covers everyone in the room.",
    spreadsheetId: "1eJiPekw81CRVHsZUvrTPGfGd0feIowq7iLJ7XeQfvws",
    gid: "1129664990",
    matchHeader: "Room number",
    matchOn: "room",
    summaryHeaders: ["Room type"],
    selfiePattern: /selfie/i,
    confirmationPattern: /confirm that we discussed/i,
    groups: [
      { title: "The room", pattern: /room type|names of all roommates|sleeping arrangement|room configuration/i },
      { title: "Substances", pattern: /substance|under the influence/i },
      { title: "Guests", pattern: /notice should roommates|overnight guest|host a group|guest boundar/i },
      { title: "Sleep and quiet", pattern: /sleeping hours|while someone is sleeping|quiet expectation/i },
      { title: "Studying and use", pattern: /studying in the room|use the room for/i },
      { title: "Cleanliness", pattern: /cleanliness|cleaning responsibilit|trash and recycling|physical environment/i },
      {
        title: "Shared space and belongings",
        pattern: /shared spaces|knock before|door when no one|without asking|considered private|damages, loses, or uses/i,
      },
      {
        title: "Communication",
        pattern: /routine that|prefer to communicate|bothering someone|communication practices|cannot be resolved/i,
      },
      { title: "Health and other boundaries", pattern: /health, allergy|other boundaries|anything else you would like/i },
    ],
  },
];

export function connectedForm(id: string): ConnectedForm | undefined {
  return connectedForms.find((form) => form.id === id);
}
