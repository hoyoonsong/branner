import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export type FormField = { label: string; value: string };
export type FormSection = { title: string; fields: FormField[] };

export type FormResponse = {
  matchValue: string;
  submittedAt: string;
  submittedAtRaw?: string;
  submitter: string;
  subtitle: string;
  confirmation: string;
  links: { label: string; url: string }[];
  sections: FormSection[];
  values: Record<string, string>;
};

export type ConnectedFormPayload = {
  id: string;
  title: string;
  description: string;
  matchOn: "room" | "email";
  responses: FormResponse[];
  fetchedAt: string | null;
  needsConnection: boolean;
  error: string | null;
};

export function useConnectedForm(id: string) {
  const [payload, setPayload] = useState<ConnectedFormPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    (fresh = false) => {
      setLoading(true);
      const query = fresh ? "?fresh=1" : "";
      return api<ConnectedFormPayload>(`/api/forms/${id}${query}`)
        .then((data) => {
          setPayload(data);
          setError("");
        })
        .catch((err: Error) => {
          setError(err.message || "Could not load form responses");
        })
        .finally(() => setLoading(false));
    },
    [id],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return { payload, error, loading, reload: () => load(true) };
}

export function responseFor(
  payload: ConnectedFormPayload | null,
  matchValue: string,
): FormResponse | null {
  if (!payload || payload.needsConnection || payload.error) return null;
  const key = payload.matchOn === "email" ? matchValue.trim().toLowerCase() : matchValue.trim();
  return payload.responses.find((row) => row.matchValue === key) ?? null;
}
