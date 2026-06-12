export type KycDocumentType = "aadhaar" | "pan";

export type KycVerificationResult = {
  ok: boolean;
  provider: string;
  documentType: KycDocumentType;
  verified: boolean;
  name: string | null;
  nameMatch?: boolean;
  maskedId: string;
  message: string;
};

export type AadhaarVerifyRequest = {
  aadhaarNumber: string;
  fullName?: string;
};

export type PanVerifyRequest = {
  panNumber: string;
  fullName?: string;
};
