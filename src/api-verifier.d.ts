/**
 * Type declarations for API Verifier
 */

export interface VerificationResult {
  passed: boolean;
  reason?: string;
  confidence?: number;
}

export interface QuickVerifyOptions {
  useAICheck?: boolean;
  checkSyntax?: boolean;
  minLength?: number;
}

export declare class APIVerifier {
  constructor(config: any, projectRoot: string);
  quickVerify(requirement: string, response: string, options?: QuickVerifyOptions): Promise<VerificationResult>;
}

export declare function quickVerify(
  config: any,
  projectRoot: string,
  requirement: string,
  response: string,
  options?: QuickVerifyOptions
): Promise<VerificationResult>;
