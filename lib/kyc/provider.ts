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

export function getKycProvider(): KycProvider {
  if (!_instance) {
    _instance = new MockKycProvider();
  }
  return _instance;
}

export function setKycProvider(provider: KycProvider): void {
  _instance = provider;
}
