/**
 * Server-side supporting-document storage helper (TASK-024).
 *
 * Server-only: imports the service-role client from @/lib/supabase/service and
 * NEVER the cookie-aware proxy.ts / the no-op server.ts client. The service
 * role bypasses RLS, so the object path convention is load-bearing for reads:
 * `{employeeId}/{uuid}{ext}` — bucket-relative, NO 'supporting-docs/' prefix
 * (the bucket id is only the .from() argument). The first folder segment
 * equals employeeId = the submitting caller's auth.uid(), so
 * storage.foldername(name)[1] satisfies the TASK-018 storage.objects policies
 * (auth_storage_insert_own / auth_storage_select_own / manager / hr).
 *
 * Validation is a storage-local defense-in-depth layer mirroring
 * validateSupportingFile in validation.ts (same MIME rules, same verbatim
 * message strings, same `>` size operator on the shared
 * MAX_SUPPORTING_FILE_BYTES so the 5MB boundary is identical client and
 * server). It does NOT own the Sick-Leave-only rule — that lives in the
 * submit handler (TASK-025) via validateSupportingFile(file, leaveType).
 *
 * Signed URLs are minted ON DEMAND with 60s expiry (adjusted A4) and are
 * never persisted or cached here; the list-response exclusion is enforced
 * downstream at TASK-026.
 *
 * No delete method exists (AGENTS.md retention: buckets block hard DELETE;
 * TASK-018 ships no DELETE policy).
 */

import { createServiceClient } from "@/lib/supabase/service";
import { MAX_SUPPORTING_FILE_BYTES } from "@/lib/leave/validation";

export type SupportingDocErrorCode =
  | "FILE_WRONG_TYPE"
  | "FILE_TOO_LARGE"
  | "UPLOAD_FAILED";

export class SupportingDocError extends Error {
  readonly code: SupportingDocErrorCode;

  constructor(code: SupportingDocErrorCode, message: string) {
    super(message);
    this.name = "SupportingDocError";
    this.code = code;
  }
}

const MESSAGE_WRONG_TYPE = "Only PDF and image files are accepted.";
const MESSAGE_TOO_LARGE = "File size must not exceed 5MB.";
const MESSAGE_UPLOAD_FAILED = "Failed to upload the supporting document.";

const BUCKET = "supporting-docs";

function extensionForMime(type: string): string {
  if (type === "application/pdf") return ".pdf";
  if (type === "image/jpeg") return ".jpg";
  return `.${type.replace("image/", "")}`;
}

/**
 * uploadSupportingDoc(file, employeeId) — validates MIME (PDF/image) and size
 * (<= 5MB, same `>` operator as validation.ts) BEFORE any upload, builds the
 * bucket-relative path `{employeeId}/{uuid}{ext}` (ext derived from MIME, not
 * file.name), uploads via the service client with `{ contentType }` (no
 * upsert), and resolves to the stored object path. Throws a typed
 * SupportingDocError on any failure.
 */
export async function uploadSupportingDoc(
  file: File,
  employeeId: string,
): Promise<string> {
  if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
    throw new SupportingDocError("FILE_WRONG_TYPE", MESSAGE_WRONG_TYPE);
  }
  if (file.size > MAX_SUPPORTING_FILE_BYTES) {
    throw new SupportingDocError("FILE_TOO_LARGE", MESSAGE_TOO_LARGE);
  }

  const uuid = crypto.randomUUID();
  const ext = extensionForMime(file.type);
  const path = `${employeeId}/${uuid}${ext}`;

  const { error } = await createServiceClient()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type });

  if (error) {
    throw new SupportingDocError("UPLOAD_FAILED", MESSAGE_UPLOAD_FAILED);
  }

  return path;
}

/**
 * getSupportingDocSignedUrl(path) — mints a 60-second signed URL ON DEMAND for
 * a bucket-relative object path. Returns null on error (fail-closed). The URL
 * is never persisted or emitted in list responses (A4, enforced at TASK-026).
 */
export async function getSupportingDocSignedUrl(
  path: string,
): Promise<string | null> {
  const { data, error } = await createServiceClient()
    .storage.from(BUCKET)
    .createSignedUrl(path, 60);

  if (error) {
    return null;
  }

  return data.signedUrl;
}
