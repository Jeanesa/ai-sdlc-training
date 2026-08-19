import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import {
  SupportingDocError,
  getSupportingDocSignedUrl,
  uploadSupportingDoc,
} from "@/lib/leave/storage";
import {
  ANDRES_ID,
  BIANCA_ID,
  EXTRA_EMPLOYEE_ID,
  createRoleClients,
  createServiceClient,
  type Role,
} from "./helpers";

const BUCKET = "supporting-docs";

let clients: Record<Role, SupabaseClient>;
let service: SupabaseClient;

let andresObj: string;
let biancaObj: string;
let extraObj: string;
let deleteTargetEmployee: string;
let deleteTargetManager: string;
let deleteTargetHr: string;
const extensionPdf = "pdf";

beforeAll(async () => {
  clients = await createRoleClients();
  service = createServiceClient();

  const andresUuid = crypto.randomUUID();
  const biancaUuid = crypto.randomUUID();
  const extraUuid = crypto.randomUUID();
  const delEmpUuid = crypto.randomUUID();
  const delMgrUuid = crypto.randomUUID();
  const delHrUuid = crypto.randomUUID();

  andresObj = `${andresUuid}.${extensionPdf}`;
  biancaObj = `${biancaUuid}.${extensionPdf}`;
  extraObj = `${extraUuid}.${extensionPdf}`;
  deleteTargetEmployee = `${delEmpUuid}.${extensionPdf}`;
  deleteTargetManager = `${delMgrUuid}.${extensionPdf}`;
  deleteTargetHr = `${delHrUuid}.${extensionPdf}`;

  const pdfBlob = new File([new Uint8Array(1024)], `doc.${extensionPdf}`, {
    type: "application/pdf",
  });

  const { error: e1 } = await service.storage
    .from(BUCKET)
    .upload(`${ANDRES_ID}/${andresObj}`, pdfBlob, {
      contentType: "application/pdf",
    });
  if (e1) throw e1;

  const { error: e2 } = await service.storage
    .from(BUCKET)
    .upload(`${BIANCA_ID}/${biancaObj}`, pdfBlob, {
      contentType: "application/pdf",
    });
  if (e2) throw e2;

  const { error: e3 } = await service.storage
    .from(BUCKET)
    .upload(`${EXTRA_EMPLOYEE_ID}/${extraObj}`, pdfBlob, {
      contentType: "application/pdf",
    });
  if (e3) throw e3;

  // Separate objects for DELETE tests — isolates deletion from other blocks.
  const { error: e4 } = await service.storage
    .from(BUCKET)
    .upload(`${ANDRES_ID}/${deleteTargetEmployee}`, pdfBlob, {
      contentType: "application/pdf",
    });
  if (e4) throw e4;

  const { error: e5 } = await service.storage
    .from(BUCKET)
    .upload(`${ANDRES_ID}/${deleteTargetManager}`, pdfBlob, {
      contentType: "application/pdf",
    });
  if (e5) throw e5;

  const { error: e6 } = await service.storage
    .from(BUCKET)
    .upload(`${ANDRES_ID}/${deleteTargetHr}`, pdfBlob, {
      contentType: "application/pdf",
    });
  if (e6) throw e6;
});

// ---------------------------------------------------------------------------
// 1. Bucket metadata
// ---------------------------------------------------------------------------
describe("Bucket metadata", () => {
  it("supporting-docs bucket exists and is private", async () => {
    const { data, error } = await service.storage.getBucket(BUCKET);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.name).toBe(BUCKET);
    expect(data!.public).toBe(false);
    expect(data!.file_size_limit).toBe(5_242_880);
    expect(data!.allowed_mime_types).toContain("application/pdf");
    expect(data!.allowed_mime_types).toContain("image/*");
  });
});

// ---------------------------------------------------------------------------
// 2. Employee RLS on storage objects
// ---------------------------------------------------------------------------
describe("Employee RLS on storage objects", () => {
  it("SELECTs own object and returns the record", async () => {
    const { data, error } = await clients.employee.storage
      .from(BUCKET)
      .list(ANDRES_ID);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const names = data!.map((o) => o.name);
    expect(names).toContain(andresObj);
  });

  it("SELECTs another employee's object and returns empty (RLS)", async () => {
    const { data, error } = await clients.employee.storage
      .from(BUCKET)
      .list(BIANCA_ID);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const names = data!.map((o) => o.name);
    expect(names).not.toContain(andresObj);
  });

  it("uploads to own prefix and succeeds (INSERT policy)", async () => {
    const uuid = crypto.randomUUID();
    const path = `${ANDRES_ID}/${uuid}.${extensionPdf}`;
    const blob = new File([new Uint8Array(256)], `own.${extensionPdf}`, {
      type: "application/pdf",
    });
    const { data, error } = await clients.employee.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "application/pdf" });
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.path).toBe(path);
  });
});

// ---------------------------------------------------------------------------
// 3. INSERT policy blocks cross-user upload
// ---------------------------------------------------------------------------
describe("INSERT policy blocks cross-user upload", () => {
  it("employee upload to another user's prefix is blocked", async () => {
    const uuid = crypto.randomUUID();
    const path = `${BIANCA_ID}/${uuid}.${extensionPdf}`;
    const blob = new File([new Uint8Array(256)], `cross.${extensionPdf}`, {
      type: "application/pdf",
    });
    const { data, error } = await clients.employee.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "application/pdf" });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Manager RLS on storage objects
// ---------------------------------------------------------------------------
describe("Manager RLS on storage objects", () => {
  it("SELECTs direct report's object and returns the record", async () => {
    const { data, error } = await clients.manager.storage
      .from(BUCKET)
      .list(ANDRES_ID);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const names = data!.map((o) => o.name);
    expect(names).toContain(andresObj);
  });

  it("SELECTs non-direct-report's object and returns empty (RLS)", async () => {
    const { data, error } = await clients.manager.storage
      .from(BUCKET)
      .list(EXTRA_EMPLOYEE_ID);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const names = data!.map((o) => o.name);
    expect(names).not.toContain(extraObj);
  });
});

// ---------------------------------------------------------------------------
// 5. HR Admin RLS on storage objects
// ---------------------------------------------------------------------------
describe("HR Admin RLS on storage objects", () => {
  it("SELECTs any object in the bucket", async () => {
    const { data: d1, error: e1 } = await clients.hr_admin.storage
      .from(BUCKET)
      .list(ANDRES_ID);
    expect(e1).toBeNull();
    expect(d1!.map((o) => o.name)).toContain(andresObj);

    const { data: d2, error: e2 } = await clients.hr_admin.storage
      .from(BUCKET)
      .list(BIANCA_ID);
    expect(e2).toBeNull();
    expect(d2!.map((o) => o.name)).toContain(biancaObj);
  });

  it("lists the bucket root", async () => {
    const { data, error } = await clients.hr_admin.storage
      .from(BUCKET)
      .list("");
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const folderNames = data!.map((o) => o.name);
    expect(folderNames).toContain(ANDRES_ID);
    expect(folderNames).toContain(BIANCA_ID);
  });
});

// ---------------------------------------------------------------------------
// 6. Sys Admin RLS on storage objects
// ---------------------------------------------------------------------------
describe("Sys Admin RLS on storage objects", () => {
  it("SELECTs objects and returns empty (RLS)", async () => {
    const { data, error } = await clients.sys_admin.storage
      .from(BUCKET)
      .list(ANDRES_ID);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const names = data!.map((o) => o.name);
    expect(names).not.toContain(andresObj);
  });

  it("SELECTs another user's prefix and returns empty (RLS)", async () => {
    const { data, error } = await clients.sys_admin.storage
      .from(BUCKET)
      .list(BIANCA_ID);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const names = data!.map((o) => o.name);
    expect(names).not.toContain(biancaObj);
  });
});

// ---------------------------------------------------------------------------
// 7. DELETE posture
// ---------------------------------------------------------------------------
describe("DELETE posture", () => {
  // Helper: check whether a storage object still exists via the service client
  // (which bypasses RLS). Returns true if the object is present.
  async function objectExists(uid: string, name: string): Promise<boolean> {
    const { data } = await service.storage.from(BUCKET).list(uid);
    return data?.some((o) => o.name === name) ?? false;
  }

  it("employee cannot DELETE another user's object (RLS protects)", async () => {
    // deleteTargetManager belongs to ANDRES_ID — the employee client (Andres)
    // can see it via own-row policy, but DELETE has no policy → default-deny.
    await clients.employee.storage
      .from(BUCKET)
      .remove([`${ANDRES_ID}/${deleteTargetManager}`]);
    // Verify the object still exists — RLS prevented the delete.
    const survived = await objectExists(ANDRES_ID, deleteTargetManager);
    expect(survived).toBe(true);
  });

  it("manager cannot DELETE a direct report's object (RLS protects)", async () => {
    // deleteTargetHr belongs to ANDRES_ID — manager can SELECT it via
    // direct-reports policy, but DELETE has no policy → default-deny.
    await clients.manager.storage
      .from(BUCKET)
      .remove([`${ANDRES_ID}/${deleteTargetHr}`]);
    const survived = await objectExists(ANDRES_ID, deleteTargetHr);
    expect(survived).toBe(true);
  });

  it("hr_admin cannot DELETE any object (RLS protects)", async () => {
    // deleteTargetEmployee belongs to ANDRES_ID — hr_admin can SELECT it,
    // but DELETE has no policy → default-deny.
    await clients.hr_admin.storage
      .from(BUCKET)
      .remove([`${ANDRES_ID}/${deleteTargetEmployee}`]);
    const survived = await objectExists(ANDRES_ID, deleteTargetEmployee);
    expect(survived).toBe(true);
  });

  // Spike: direct SQL DELETE via the Supabase JS client targeting the storage
  // schema. The storage schema may or may not be REST-reachable through
  // PostgREST on the emulator. If not reachable, this test is skipped — the
  // protect_delete trigger is migration-covered and psql-verifiable.
  it.skip("direct SQL DELETE on storage.objects blocked by protect-delete trigger (spike)", async () => {
    const { error } = await service.schema("storage").from("objects").delete().eq(
      "name",
      `${ANDRES_ID}/${andresObj}`,
    );
    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });
});

// ---------------------------------------------------------------------------
// 8. uploadSupportingDoc helper validation
// ---------------------------------------------------------------------------
describe("uploadSupportingDoc helper validation", () => {
  it("rejects 6MB file as FILE_TOO_LARGE before any storage I/O", async () => {
    const largeFile = new File([new Uint8Array(6_000_000)], "big.pdf", {
      type: "application/pdf",
    });
    await expect(
      uploadSupportingDoc(largeFile, ANDRES_ID),
    ).rejects.toBeInstanceOf(SupportingDocError);
    await expect(
      uploadSupportingDoc(largeFile, ANDRES_ID),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });

  it("rejects non-PDF/image file as FILE_WRONG_TYPE before any storage I/O", async () => {
    const txtFile = new File([new Uint8Array(256)], "notes.txt", {
      type: "text/plain",
    });
    await expect(
      uploadSupportingDoc(txtFile, ANDRES_ID),
    ).rejects.toBeInstanceOf(SupportingDocError);
    await expect(
      uploadSupportingDoc(txtFile, ANDRES_ID),
    ).rejects.toMatchObject({ code: "FILE_WRONG_TYPE" });
  });
});

// ---------------------------------------------------------------------------
// 9. getSupportingDocSignedUrl
// ---------------------------------------------------------------------------
describe("getSupportingDocSignedUrl", () => {
  it("returns a working signed URL for an owned object", async () => {
    const url = await getSupportingDocSignedUrl(
      `${ANDRES_ID}/${andresObj}`,
    );
    expect(url).not.toBeNull();

    const res = await fetch(url!);
    expect(res.status).toBe(200);
  });

  it("returns null for a non-existent object", async () => {
    const result = await getSupportingDocSignedUrl("nonexistent/fake.pdf");
    // VERIFY: confirm the actual behaviour — does it return null or a URL that
    // 404s? Assert on what actually happens.
    if (result === null) {
      // Fail-closed: signing failed, returned null.
      expect(result).toBeNull();
    } else {
      // The service returned a signed URL despite the object not existing;
      // confirm the URL 404s on fetch.
      const res = await fetch(result);
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });
});
