import { isRa, type Resident } from "./types";

export type ContractPerson = Pick<Resident, "id" | "type" | "room">;

/** Shared rooms of two or more residents are expected to turn in one agreement. */
export function roomNeedsContract(people: ContractPerson[]): boolean {
  const residents = people.filter((person) => !isRa(person) && /^\d+$/.test(person.room ?? ""));
  return new Set(residents.map((person) => person.id)).size >= 2;
}
