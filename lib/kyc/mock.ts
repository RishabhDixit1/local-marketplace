import type {
  KycVerificationResult,
  AadhaarVerifyRequest,
  PanVerifyRequest,
} from "./types";
import type { KycProvider } from "./provider";

function mask(value: string, visible: number): string {
  return value.length > visible
    ? "X".repeat(value.length - visible) + value.slice(-visible)
    : value;
}

export class MockKycProvider implements KycProvider {
  readonly name = "mock";

  async verifyAadhaar(
    request: AadhaarVerifyRequest,
  ): Promise<KycVerificationResult> {
    const sanitized = request.aadhaarNumber.replace(/\s+/g, "");
    if (!/^\d{12}$/.test(sanitized)) {
      return {
        ok: false,
        provider: this.name,
        documentType: "aadhaar",
        verified: false,
        name: null,
        maskedId: mask(sanitized, 4),
        message: "Invalid Aadhaar number. Must be 12 digits.",
      };
    }

    return {
      ok: true,
      provider: this.name,
      documentType: "aadhaar",
      verified: true,
      name: request.fullName ?? "Demo User",
      nameMatch: true,
      maskedId: mask(sanitized, 4),
      message: "Aadhaar verified successfully (mock).",
    };
  }

  async verifyPan(
    request: PanVerifyRequest,
  ): Promise<KycVerificationResult> {
    const sanitized = request.panNumber.toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(sanitized)) {
      return {
        ok: false,
        provider: this.name,
        documentType: "pan",
        verified: false,
        name: null,
        maskedId: mask(sanitized, 4),
        message: "Invalid PAN number. Must be 10 characters (AAAAA9999A).",
      };
    }

    return {
      ok: true,
      provider: this.name,
      documentType: "pan",
      verified: true,
      name: request.fullName ?? "Demo User",
      nameMatch: true,
      maskedId: mask(sanitized, 4),
      message: "PAN verified successfully (mock).",
    };
  }
}
