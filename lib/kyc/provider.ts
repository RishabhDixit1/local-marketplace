import type {
  KycVerificationResult,
  AadhaarVerifyRequest,
  PanVerifyRequest,
} from "./types";
import { MockKycProvider } from "./mock";

export interface KycProvider {
  readonly name: string;
  verifyAadhaar(request: AadhaarVerifyRequest): Promise<KycVerificationResult>;
  verifyPan(request: PanVerifyRequest): Promise<KycVerificationResult>;
}

let _instance: KycProvider | null = null;
let _prodCheckDone = false;

export function getKycProvider(): KycProvider {
  if (!_instance) {
    if (process.env.NODE_ENV === "production" && !_prodCheckDone) {
      console.error(
        "[KYC] No real KYC provider configured via setKycProvider(). " +
        "All KYC verifications will fail until a real provider is set.",
      );
      _prodCheckDone = true;
    }
    _instance = new MockKycProvider();
  }
  return _instance;
}

export function setKycProvider(provider: KycProvider): void {
  _instance = provider;
}

export function isKycConfigured(): boolean {
  return _instance !== null && _instance.name !== "mock";
}
