import type { FormResponse } from "./connectedForm";
import { isRa, type Resident } from "./types";

export type ContractPerson = Pick<Resident, "id" | "type" | "room">;

const WANTS_RA_PRESENT = /we would like an ra present for this conversation/i;

export function wantsRaPresent(value: string): boolean {
  return WANTS_RA_PRESENT.test(value);
}

const ROOM_CONFIGURATION = /room configuration|sleeping arrangement/i;

/** Room configuration notes that mention a single, such as "single bed". */
export function isSingleConfiguration(label: string, value: string): boolean {
  return ROOM_CONFIGURATION.test(label) && /\bsingle\b/i.test(value);
}

export function raHelpPrompt(label: string): string {
  const prompt = label
    .replace(/\s*if you need help,?\s*talk to an ra(?:\s+on this)?\.?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return prompt || label.trim();
}

export type ContractFlag = {
  kind: "ra" | "single";
  label: string;
  prompt: string;
  value: string;
};

/** Answers that ask for an RA, or a room configuration that mentions a single. */
export function contractFlags(response: Pick<FormResponse, "sections" | "values">): ContractFlag[] {
  const byKey = new Map<string, ContractFlag>();
  const consider = (label: string, value: string) => {
    const trimmed = value.trim();
    if (!label || !trimmed) return;
    const kind = wantsRaPresent(trimmed) ? "ra" : isSingleConfiguration(label, trimmed) ? "single" : null;
    if (!kind) return;
    byKey.set(`${kind}:${label}`, {
      kind,
      label,
      prompt: raHelpPrompt(label),
      value: trimmed,
    });
  };
  for (const [label, value] of Object.entries(response.values)) consider(label, value);
  for (const section of response.sections) {
    for (const field of section.fields) consider(field.label, field.value);
  }
  return [...byKey.values()];
}

/** Shared rooms of two or more residents are expected to turn in one agreement. */
export function roomNeedsContract(people: ContractPerson[]): boolean {
  const residents = people.filter((person) => !isRa(person) && /^\d+$/.test(person.room ?? ""));
  return new Set(residents.map((person) => person.id)).size >= 2;
}
