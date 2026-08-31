import { authenticatedRequest } from "./auth";

export type DocumentSummary = {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type DownloadedDocument = DocumentSummary & {
  fileContentBase64: string;
};

export const getDocuments = () =>
  authenticatedRequest<{ success: boolean; data: DocumentSummary[] }>(
    "/api/documents",
  );

export const createDocument = (body: {
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  fileContentBase64: string;
}) =>
  authenticatedRequest<{
    success: boolean;
    message: string;
    data: DocumentSummary;
  }>("/api/documents", {
    method: "POST",
    body,
  });

export const downloadDocument = (id: string) =>
  authenticatedRequest<{ success: boolean; data: DownloadedDocument }>(
    `/api/documents/${id}/download`,
  );

export const deleteDocument = (id: string) =>
  authenticatedRequest<{ success: boolean; message: string }>(
    `/api/documents/${id}`,
    {
      method: "DELETE",
    },
  );
