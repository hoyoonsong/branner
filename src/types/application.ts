// ---------------------------------------------------------------------------
// The builder's internal "AppItem" model, ported from apply-hub (Neopply).
//
// This is ONLY used inside the visual builder — specifically the drag-and-drop
// question list and the React Flow "If / Then" flowchart editor. It is bridged
// to the app's storage/runtime model (`FormField` in `lib/types.ts`) by the
// converters in `lib/appItemConvert.ts`.
// ---------------------------------------------------------------------------

import type {
  AddressPart,
  HeadshotAspect,
  MeetAndGreetHostType,
  RegisterLayer,
  RegisterTarget,
  VolunteerRegisterStatus,
  YardSignStatus,
} from '../lib/types';

export type StandardFieldType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'select'
  | 'multiple_choice'
  | 'checkbox'
  | 'address'
  | 'location'
  | 'section'
  | 'file'
  | 'headshot'
  | 'waiver';

export type StandardAppItem =
  | { type: 'short_text'; label: string; key?: string; required?: boolean }
  | { type: 'long_text'; label: string; key?: string; required?: boolean; maxWords?: number }
  | { type: 'number'; label: string; key?: string; required?: boolean }
  | { type: 'email'; label: string; key?: string; required?: boolean }
  | { type: 'phone'; label: string; key?: string; required?: boolean }
  | { type: 'date'; label: string; key?: string; required?: boolean }
  | {
      type: 'section';
      label: string;
      key?: string;
      richText?: string;
      /** Optional https page to embed under the statement (e.g. donate). */
      embedUrl?: string;
    }
  | {
      type: 'address';
      label: string;
      key?: string;
      required?: boolean;
      addressFields?: AddressPart[];
    }
  | { type: 'location'; label: string; key?: string; required?: boolean }
  | { type: 'select'; label: string; key?: string; required?: boolean; options: string[] }
  | {
      type: 'multiple_choice';
      label: string;
      key?: string;
      required?: boolean;
      options: string[];
      /** When true, applicants may select more than one option. */
      allowMultiple?: boolean;
      /** When true, show an "Other" option with a free-text response. */
      allowOther?: boolean;
    }
  | { type: 'checkbox'; label: string; key?: string; required?: boolean }
  | { type: 'file'; label: string; key?: string; required?: boolean; allowLink?: boolean }
  | {
      type: 'headshot';
      label: string;
      key?: string;
      required?: boolean;
      headshotAspect?: HeadshotAspect;
    }
  | {
      type: 'waiver';
      label: string;
      key?: string;
      required?: boolean;
      /** The agreement text the applicant must accept. */
      waiverText?: string;
      requireSignature?: boolean;
      requireDate?: boolean;
    };

export type ConditionalTriggerType = 'select' | 'multiple_choice' | 'checkbox';

export type ConditionalBranch = {
  whenValue: string;
  fields: AppItem[];
};

export type ConditionalBlock = {
  type: 'conditional';
  label: string;
  key?: string;
  required?: boolean;
  triggerType: ConditionalTriggerType;
  options?: string[];
  branches: ConditionalBranch[];
  /** Per-option auto-filing (same shape as FormField.connectRegister). */
  connectRegister?: Record<string, RegisterTarget>;
  /** Per-option yard-sign status when filing to Yard Signs. */
  connectYardStatus?: Partial<Record<string, YardSignStatus>>;
  /** Per-option volunteer status when filing to Volunteers. */
  connectVolunteerStatus?: Partial<Record<string, VolunteerRegisterStatus>>;
  /** Per-option map layer (e.g. yard_sign vs yard_sign_big). */
  connectLayer?: Partial<Record<string, RegisterLayer>>;
  /** Per-option host type when filing to Host Events. */
  connectHostType?: Partial<Record<string, MeetAndGreetHostType>>;
  /** Per-option custom page id when connectRegister is `custom`. */
  connectCustomPageId?: Record<string, string>;
  /** Per-option named map dot when filing to a custom page. */
  connectCustomLocationId?: Record<string, string>;
  /** Per-option custom page layer key. */
  connectCustomLayer?: Record<string, string>;
};

export type AppItem = StandardAppItem | ConditionalBlock;

export type Answers = Record<string, unknown>;
