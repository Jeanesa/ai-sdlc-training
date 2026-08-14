import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceClient } from "@/lib/supabase/service";
import {
  SupportingDocError,
  getSupportingDocSignedUrl,
  uploadSupportingDoc,
} from "@/lib/leave/storage";

const EMPLOYEE_ID = "10000000-0000-4000-8000-000000000001";
const UUID = "aaaaaaaa-0000-4000-8000-000000000000";
const SIGNED_URL = "https://example.com/object/signed";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

interface FakeStorageInput {
  upload?: { data: { path: string } | null; error: unknown };
  createSignedUrl?: { data: { signedUrl: string } | null; error: unknown };
}

function installFakeStorage(input: FakeStorageInput): {
  upload: ReturnType<typeof vi.fn>;
  createSignedUrl: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
} {
  const upload = vi.fn().mockResolvedValue(input.upload);
  const createSignedUrl = vi.fn().mockResolvedValue(input.createSignedUrl);
  const from = vi.fn().mockReturnValue({ upload, createSignedUrl });
  vi.mocked(createServiceClient).mockReturnValue({
    storage: { from },
  } as unknown as SupabaseClient);
  return { upload, createSignedUrl, from };
}

function makeFile(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

beforeEach(() => {
  vi.mocked(createServiceClient).mockReset();
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(UUID);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("uploadSupportingDoc", () => {
  it("uploads a valid PDF under employeeId/{uuid}.pdf with contentType and returns the exact path", async () => {
    const { from, upload } = installFakeStorage({
      upload: { data: { path: `${EMPLOYEE_ID}/${UUID}.pdf` }, error: null },
    });

    const path = await uploadSupportingDoc(
      makeFile("doc.pdf", "application/pdf", 1024),
      EMPLOYEE_ID,
    );

    expect(path).toBe(`${EMPLOYEE_ID}/${UUID}.pdf`);
    expect(from).toHaveBeenCalledWith("supporting-docs");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(
      `${EMPLOYEE_ID}/${UUID}.pdf`,
      expect.any(File),
      { contentType: "application/pdf" },
    );
  });

  it("derives .jpg for image/jpeg and passes the MIME through as contentType", async () => {
    const { upload } = installFakeStorage({
      upload: { data: { path: `${EMPLOYEE_ID}/${UUID}.jpg` }, error: null },
    });

    const path = await uploadSupportingDoc(
      makeFile("scan.jpg", "image/jpeg", 1024),
      EMPLOYEE_ID,
    );

    expect(path).toBe(`${EMPLOYEE_ID}/${UUID}.jpg`);
    expect(upload).toHaveBeenCalledWith(
      `${EMPLOYEE_ID}/${UUID}.jpg`,
      expect.any(File),
      { contentType: "image/jpeg" },
    );
  });

  it("allows any image/* subtype (heic) and derives .heic", async () => {
    const { upload } = installFakeStorage({
      upload: { data: { path: `${EMPLOYEE_ID}/${UUID}.heic` }, error: null },
    });

    const path = await uploadSupportingDoc(
      makeFile("scan.heic", "image/heic", 1024),
      EMPLOYEE_ID,
    );

    expect(path).toBe(`${EMPLOYEE_ID}/${UUID}.heic`);
    expect(upload).toHaveBeenCalledWith(
      `${EMPLOYEE_ID}/${UUID}.heic`,
      expect.any(File),
      { contentType: "image/heic" },
    );
  });

  it("accepts a file exactly at the 5MB boundary (same `>` operator as validation.ts)", async () => {
    const { upload } = installFakeStorage({
      upload: { data: { path: `${EMPLOYEE_ID}/${UUID}.pdf` }, error: null },
    });

    const path = await uploadSupportingDoc(
      makeFile("doc.pdf", "application/pdf", 5_242_880),
      EMPLOYEE_ID,
    );

    expect(path).toBe(`${EMPLOYEE_ID}/${UUID}.pdf`);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("throws FILE_TOO_LARGE for a file over 5MB without calling upload", async () => {
    const { upload } = installFakeStorage({});

    await expect(
      uploadSupportingDoc(
        makeFile("doc.pdf", "application/pdf", 5_242_881),
        EMPLOYEE_ID,
      ),
    ).rejects.toBeInstanceOf(SupportingDocError);
    await expect(
      uploadSupportingDoc(
        makeFile("doc.pdf", "application/pdf", 5_242_881),
        EMPLOYEE_ID,
      ),
    ).rejects.toMatchObject({
      code: "FILE_TOO_LARGE",
      message: "File size must not exceed 5MB.",
    });

    expect(upload).not.toHaveBeenCalled();
  });

  it("throws FILE_WRONG_TYPE for a non-PDF/image file without calling upload", async () => {
    const { upload } = installFakeStorage({});

    await expect(
      uploadSupportingDoc(makeFile("notes.txt", "text/plain", 1024), EMPLOYEE_ID),
    ).rejects.toBeInstanceOf(SupportingDocError);
    await expect(
      uploadSupportingDoc(makeFile("notes.txt", "text/plain", 1024), EMPLOYEE_ID),
    ).rejects.toMatchObject({
      code: "FILE_WRONG_TYPE",
      message: "Only PDF and image files are accepted.",
    });
    await expect(
      uploadSupportingDoc(
        makeFile("bin.dat", "application/octet-stream", 1024),
        EMPLOYEE_ID,
      ),
    ).rejects.toMatchObject({ code: "FILE_WRONG_TYPE" });

    expect(upload).not.toHaveBeenCalled();
  });

  it("returns FILE_WRONG_TYPE before FILE_TOO_LARGE when both fail", async () => {
    const { upload } = installFakeStorage({});

    await expect(
      uploadSupportingDoc(makeFile("notes.txt", "text/plain", 5_242_881), EMPLOYEE_ID),
    ).rejects.toMatchObject({
      code: "FILE_WRONG_TYPE",
      message: "Only PDF and image files are accepted.",
    });

    expect(upload).not.toHaveBeenCalled();
  });

  it("throws UPLOAD_FAILED when the storage upload returns an error", async () => {
    const { upload } = installFakeStorage({
      upload: { data: null, error: { name: "StorageApiError", message: "upload failed" } },
    });

    await expect(
      uploadSupportingDoc(
        makeFile("doc.pdf", "application/pdf", 1024),
        EMPLOYEE_ID,
      ),
    ).rejects.toMatchObject({
      code: "UPLOAD_FAILED",
      message: "Failed to upload the supporting document.",
    });

    expect(upload).toHaveBeenCalledWith(
      `${EMPLOYEE_ID}/${UUID}.pdf`,
      expect.any(File),
      { contentType: "application/pdf" },
    );
  });
});

describe("getSupportingDocSignedUrl", () => {
  it("returns the signed URL minted with a 60s expiry for the exact path", async () => {
    const { from, createSignedUrl } = installFakeStorage({
      createSignedUrl: { data: { signedUrl: SIGNED_URL }, error: null },
    });

    const url = await getSupportingDocSignedUrl(`${EMPLOYEE_ID}/${UUID}.pdf`);

    expect(url).toBe(SIGNED_URL);
    expect(from).toHaveBeenCalledWith("supporting-docs");
    expect(createSignedUrl).toHaveBeenCalledWith(`${EMPLOYEE_ID}/${UUID}.pdf`, 60);
  });

  it("returns null (fail-closed) when signing fails", async () => {
    const { createSignedUrl } = installFakeStorage({
      createSignedUrl: { data: null, error: { name: "StorageApiError", message: "not found" } },
    });

    await expect(
      getSupportingDocSignedUrl(`${EMPLOYEE_ID}/${UUID}.pdf`),
    ).resolves.toBeNull();

    expect(createSignedUrl).toHaveBeenCalledWith(`${EMPLOYEE_ID}/${UUID}.pdf`, 60);
  });
});
