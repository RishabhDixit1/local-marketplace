export { getKycProvider, setKycProvider, isKycConfigured } from "./provider";
export type { KycProvider } from "./provider";
export { MockKycProvider } from "./mock";
export type {
  KycVerificationResult,
  KycDocumentType,
  AadhaarVerifyRequest,
  PanVerifyRequest,
} from "./types";
