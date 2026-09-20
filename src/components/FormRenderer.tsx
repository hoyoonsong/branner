import { useMemo } from "react";
import { useForm, type FieldValues } from "react-hook-form";
import type { FormField, FormSchema } from "../lib/types";
import { buildDefaultValues, makeFormResolver } from "../lib/formSchema";
import { getActiveBranch, triggerAsField } from "../lib/conditional";
import { clsx } from "../lib/utils";

export function FormRenderer({
  schema,
  onSubmit,
  submitting,
  submitLabel = "Submit",
  disabled,
  defaultValues,
}: {
  schema: FormSchema;
  onSubmit: (data: Record<string, unknown>) => void | Promise<void>;
  submitting?: boolean;
  submitLabel?: string;
  disabled?: boolean;
  defaultValues?: Record<string, unknown>;
}) {
  const resolver = useMemo(() => makeFormResolver(schema), [schema]);
  const defaults = useMemo(
    () => ({ ...buildDefaultValues(schema), ...defaultValues }),
    [schema, defaultValues],
  );
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FieldValues>({ resolver, defaultValues: defaults });
  const values = watch();

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit((data) => onSubmit(data as Record<string, unknown>))}
    >
      {schema.fields.map((field) => (
        <FieldBlock
          key={field.id}
          field={field}
          values={values}
          register={register}
          errors={errors as Record<string, { message?: string }>}
        />
      ))}
      <button
        type="submit"
        disabled={disabled || submitting}
        className="w-full rounded-lg bg-cardinal px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-stone-400"
      >
        {submitting ? "Submitting…" : submitLabel}
      </button>
    </form>
  );
}

function FieldBlock({
  field,
  values,
  register,
  errors,
}: {
  field: FormField;
  values: Record<string, unknown>;
  register: ReturnType<typeof useForm>["register"];
  errors: Record<string, { message?: string }>;
}) {
  if (field.type === "conditional") {
    const trigger = triggerAsField(field);
    const branch = getActiveBranch(field, values[field.id]);
    return (
      <div className="space-y-4 rounded-xl border border-black/5 bg-white p-4">
        <InputField field={trigger} register={register} error={errors[field.id]?.message} />
        {branch?.fields.map((child) => (
          <FieldBlock
            key={child.id}
            field={child}
            values={values}
            register={register}
            errors={errors}
          />
        ))}
      </div>
    );
  }
  return <InputField field={field} register={register} error={errors[field.id]?.message} />;
}

function InputField({
  field,
  register,
  error,
}: {
  field: FormField;
  register: ReturnType<typeof useForm>["register"];
  error?: string;
}) {
  const label = (
    <label className="mb-1.5 block text-sm font-medium">
      {field.label || "Untitled"}
      {field.required && <span className="text-cardinal"> *</span>}
    </label>
  );
  const box = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-cardinal";

  if (field.type === "heading") {
    if (field.richText) {
      return <div className="prose prose-sm" dangerouslySetInnerHTML={{ __html: field.richText }} />;
    }
    return <h3 className="font-display text-lg">{field.label}</h3>;
  }
  if (field.type === "location") {
    return (
      <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-900">
        Location is captured automatically at check-in. You cannot type or edit it.
      </div>
    );
  }
  if (field.type === "waiver") {
    return (
      <div>
        {field.waiverText && <p className="mb-2 whitespace-pre-wrap text-sm text-stone-mute">{field.waiverText}</p>}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register(`${field.id}.agreed`)} />
          I agree{field.required && <span className="text-cardinal"> *</span>}
        </label>
        {error && <p className="mt-1 text-xs text-cardinal">{error}</p>}
      </div>
    );
  }
  if (field.type === "file" || field.type === "headshot") {
    return (
      <div>
        {label}
        <input className={box} type="text" placeholder="https://… or note" {...register(field.id)} />
        {error && <p className="mt-1 text-xs text-cardinal">{error}</p>}
      </div>
    );
  }
  if (field.type === "address") {
    return (
      <div className="space-y-2">
        {label}
        {["line1", "line2", "city", "state", "zip"].map((part) => (
          <input
            key={part}
            className={box}
            placeholder={part}
            {...register(`${field.id}.${part}`)}
          />
        ))}
        {error && <p className="mt-1 text-xs text-cardinal">{error}</p>}
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div>
        {label}
        <textarea className={clsx(box, "min-h-[88px]")} placeholder={field.placeholder} {...register(field.id)} />
        {error && <p className="mt-1 text-xs text-cardinal">{error}</p>}
      </div>
    );
  }
  if (field.type === "radio") {
    return (
      <div>
        {label}
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <input type={field.allowMultiple ? "checkbox" : "radio"} value={opt} {...register(field.id)} />
              {opt}
            </label>
          ))}
        </div>
        {error && <p className="mt-1 text-xs text-cardinal">{error}</p>}
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div>
        {label}
        <select className={box} {...register(field.id)}>
          <option value="">Select…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-cardinal">{error}</p>}
      </div>
    );
  }
  if (field.type === "checkbox") {
    return (
      <div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register(field.id)} />
          {field.label || "Untitled"}
          {field.required && <span className="text-cardinal"> *</span>}
        </label>
        {error && <p className="mt-1 text-xs text-cardinal">{error}</p>}
      </div>
    );
  }
  if (field.type === "yesno") {
    return (
      <div>
        {label}
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" value="yes" {...register(field.id)} /> Yes
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="no" {...register(field.id)} /> No
          </label>
        </div>
        {error && <p className="mt-1 text-xs text-cardinal">{error}</p>}
      </div>
    );
  }
  const inputType =
    field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "phone" ? "tel" : "text";
  return (
    <div>
      {label}
      <input className={box} type={inputType} placeholder={field.placeholder} {...register(field.id)} />
      {field.help && <p className="mt-1 text-xs text-stone-mute">{field.help}</p>}
      {error && <p className="mt-1 text-xs text-cardinal">{error}</p>}
    </div>
  );
}
