export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "checkbox"
  | "yesno"
  | "address"
  | "heading"
  | "file"
  | "headshot"
  | "waiver"
  | "location"
  | "conditional";

export type RegisterTarget =
  | "volunteers"
  | "yard_signs"
  | "events"
  | "meet_and_greets"
  | "custom"
  | null;
export type RegisterLayer = string;
export type YardSignStatus = string;
export type VolunteerRegisterStatus = string;
export type MeetAndGreetHostType = string;

export const REGISTER_LAYERS: Record<string, { value: string; label: string }[]> = {};
export function defaultRegisterLayer(_t?: RegisterTarget): RegisterLayer | null {
  return null;
}

export interface ConditionalBranch {
  whenValue: string;
  fields: FormField[];
}

export type HeadshotAspect = "4:5" | "1:1" | "3:4";
export const HEADSHOT_DEFAULT_ASPECT: HeadshotAspect = "4:5";
export const HEADSHOT_ASPECT_META: { key: HeadshotAspect; label: string; w: number; h: number }[] = [
  { key: "4:5", label: "Portrait (4:5)", w: 4, h: 5 },
  { key: "1:1", label: "Square (1:1)", w: 1, h: 1 },
  { key: "3:4", label: "Portrait (3:4)", w: 3, h: 4 },
];

export interface HeadshotValue {
  path: string;
  width: number;
  height: number;
  filename?: string;
}

export interface AddressValue {
  line1?: string;
  line2?: string;
  city?: string;
  county?: string;
  state?: string;
  zip?: string;
}

export type AddressPart = "line1" | "line2" | "city" | "county" | "state" | "zip";
export const ADDRESS_PART_META: { key: AddressPart; label: string }[] = [
  { key: "line1", label: "Street address" },
  { key: "line2", label: "Apt / Suite (line 2)" },
  { key: "city", label: "City" },
  { key: "county", label: "County" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP code" },
];
export const DEFAULT_ADDRESS_PARTS: AddressPart[] = ["line1", "line2", "city", "state", "zip"];
export const DEFAULT_STATE = "CA";
export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois",
  "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts",
  "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
  "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming",
] as const;

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  optionItems?: { label: string; value: string }[];
  otherSuggestionItems?: { label: string; value: string }[];
  help?: string;
  richText?: string;
  embedUrl?: string;
  width?: "full" | "half";
  allowMultiple?: boolean;
  allowOther?: boolean;
  maxWords?: number;
  allowLink?: boolean;
  headshotAspect?: HeadshotAspect;
  waiverText?: string;
  requireSignature?: boolean;
  requireDate?: boolean;
  addressFields?: AddressPart[];
  registerLayer?: RegisterLayer | null;
  connectRegister?: Record<string, RegisterTarget>;
  connectYardStatus?: Partial<Record<string, YardSignStatus>>;
  connectVolunteerStatus?: Partial<Record<string, VolunteerRegisterStatus>>;
  connectLayer?: Partial<Record<string, RegisterLayer>>;
  connectHostType?: Partial<Record<string, MeetAndGreetHostType>>;
  connectCustomPageId?: Record<string, string>;
  connectCustomLocationId?: Record<string, string>;
  connectCustomLayer?: Record<string, string>;
  triggerType?: "select" | "radio" | "checkbox";
  branches?: ConditionalBranch[];
}

export interface FormSchema {
  fields: FormField[];
}

export const NON_INPUT_TYPES: FieldType[] = ["heading", "conditional"];
export const OPTION_TYPES: FieldType[] = ["select", "radio"];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  email: "Email",
  phone: "Phone",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  radio: "Multiple choice",
  checkbox: "Checkbox",
  yesno: "Yes / No",
  address: "Address",
  heading: "Section heading",
  file: "File upload",
  headshot: "Image upload",
  waiver: "Waiver",
  location: "Location",
  conditional: "If / Then",
};

export interface PaletteItem {
  type: FieldType;
  label: string;
  accent: string;
  icon: string;
}

export const BUILDER_PALETTE: PaletteItem[] = [
  { type: "text", label: "Short Text", accent: "emerald", icon: "—" },
  { type: "radio", label: "Multiple Choice", accent: "fuchsia", icon: "◉" },
  { type: "checkbox", label: "Checkbox", accent: "rose", icon: "☑" },
  { type: "address", label: "Address", accent: "teal", icon: "🏠" },
  { type: "location", label: "Location", accent: "cyan", icon: "📍" },
  { type: "conditional", label: "If / Then", accent: "indigo", icon: "⤳" },
];

export const OTHER_PALETTE: PaletteItem[] = [
  { type: "select", label: "Dropdown", accent: "violet", icon: "▾" },
  { type: "textarea", label: "Long Text", accent: "sky", icon: "¶" },
  { type: "number", label: "Number", accent: "amber", icon: "#" },
  { type: "email", label: "Email", accent: "emerald", icon: "@" },
  { type: "phone", label: "Phone", accent: "sky", icon: "☎" },
  { type: "date", label: "Date", accent: "amber", icon: "📅" },
  { type: "yesno", label: "Yes / No", accent: "fuchsia", icon: "◑" },
  { type: "headshot", label: "Image Upload", accent: "rose", icon: "🖼" },
  { type: "heading", label: "Section Heading", accent: "slate", icon: "H" },
];

export function fieldAccent(type: FieldType): string {
  return (
    [...BUILDER_PALETTE, ...OTHER_PALETTE].find((p) => p.type === type)?.accent ?? "slate"
  );
}

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  status: "pending" | "approved" | "rejected" | string;
};

export type Resident = {
  id: string;
  firstName: string;
  lastName: string;
  legalName: string | null;
  email: string;
  building: string;
  bedSlot: string;
  room: string;
  hall: string;
  type: string;
  gender: string | null;
  minor: string | null;
  hometown: string | null;
  country: string | null;
  phone: string | null;
  suid: string | null;
  tshirtSize: string | null;
  checkIn: string | null;
  earlyArrival: string | null;
  photoPath: string | null;
  birthday?: string | null;
  notes: string;
};

export function isRa(resident: { type?: string | null } | null | undefined): boolean {
  return (resident?.type ?? "").trim().toUpperCase() === "RA";
}

export function isHouseMeeting(
  eventType?: { slug?: string | null; label?: string | null } | null,
): boolean {
  if (!eventType) return false;
  const slug = (eventType.slug ?? "").toLowerCase();
  return slug === "house-meeting" || /house\s*meeting/i.test(eventType.label ?? "");
}

export function eventIsHouseMeeting(event: {
  houseMeeting?: boolean | null;
  eventType?: { slug?: string | null; label?: string | null } | null;
}): boolean {
  if (typeof event.houseMeeting === "boolean") return event.houseMeeting;
  return isHouseMeeting(event.eventType);
}

export type FormStatus = "draft" | "published";

export type EventType = { id: string; label: string; slug: string };

export type AttendanceEvent = {
  id: string;
  title: string;
  eventTypeId: string;
  eventType?: EventType;
  startsAt: string;
  endsAt: string | null;
  requireLogin: boolean;
  locationTracking: boolean;
  houseMeeting?: boolean | null;
  oneResponse?: boolean;
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
  formSchema: FormSchema;
  slug: string;
  _count?: { submissions: number };
};
