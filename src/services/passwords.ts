import { authenticatedRequest } from "./auth";
export type PasswordEntry = {
  id: string;
  title: string;
  key: string;
  value: string;
  created_at: string;
};
export type PasswordEntrySummary = {
  id: string;
  title: string;
  created_at: string;
};
type SecretResponse = { success: boolean; data: PasswordEntry };
type SummaryResponse = { success: boolean; data: PasswordEntrySummary };
export const getPasswords = () =>
  authenticatedRequest<{ success: boolean; data: PasswordEntrySummary[] }>(
    "/api/passwords",
  );
export const getPasswordSecret = (id: string) =>
  authenticatedRequest<SecretResponse>(`/api/passwords/${id}/secret`);
export const createPassword = (
  body: Pick<PasswordEntry, "title" | "key" | "value">,
) =>
  authenticatedRequest<SummaryResponse>("/api/passwords", {
    method: "POST",
    body,
  });
export const updatePassword = (
  id: string,
  body: Pick<PasswordEntry, "title" | "key" | "value">,
) =>
  authenticatedRequest<SummaryResponse>(`/api/passwords/${id}`, {
    method: "PATCH",
    body,
  });
export const deletePassword = (id: string) =>
  authenticatedRequest<{ success: boolean }>(`/api/passwords/${id}`, {
    method: "DELETE",
  });
