import axios, { AxiosInstance, AxiosError } from 'axios';
import * as crypto from 'crypto';

// Base URL encoded in base64 for obfuscation
const DEFAULT_BASE_URL_B64 = 'aHR0cHM6Ly9rZXljbGFpbS5vcmc='; // https://keyclaim.org

/**
 * Configuration for KeyClaimClient
 */
export interface KeyClaimConfig {
  /** Your KeyClaim API key (must start with 'kc_') */
  apiKey: string;
  /** Secret for HMAC generation (defaults to API key) */
  secret?: string;
}

/**
 * Options for creating a challenge
 */
export interface CreateChallengeOptions {
  /** Time to live in seconds (default: 30) */
  ttl?: number;
}

/**
 * Response from creating a challenge
 */
export interface CreateChallengeResponse {
  /** The challenge string */
  challenge: string;
  /** Expiration time in seconds */
  expires_in: number;
  /** Whether the challenge is encrypted */
  encrypted?: boolean;
}

/**
 * Options for validating a challenge
 */
export interface ValidateChallengeOptions {
  /** The challenge string */
  challenge: string;
  /** The generated response */
  response: string;
  /** Decrypted challenge (if challenge was encrypted) */
  decryptedChallenge?: string;
}

/**
 * Response from validating a challenge
 */
export interface ValidateChallengeResponse {
  /** Whether the validation was successful */
  valid: boolean;
  /** Signature (if signed responses are enabled) */
  signature?: string;
  /** Quota information */
  quota?: {
    used: number;
    remaining: number;
    quota: number | 'unlimited';
  };
  /** Error message (if validation failed) */
  error?: string;
}

/**
 * Response generation methods
 */
export type ResponseMethod = 'echo' | 'hmac' | 'hash' | 'custom';

/**
 * Custom error class for KeyClaim SDK errors
 */
export class KeyClaimError extends Error {
  /**
   * Error code
   */
  public readonly code?: string;
  
  /**
   * HTTP status code
   */
  public readonly statusCode?: number;

  constructor(
    message: string,
    code?: string,
    statusCode?: number
  ) {
    super(message);
    this.name = 'KeyClaimError';
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, KeyClaimError.prototype);
  }
}

/**
 * KeyClaim SDK Client for TypeScript
 * 
 * @example
 * ```typescript
 * import { KeyClaimClient } from '@keyclaim/sdk-typescript';
 * 
 * const client = new KeyClaimClient({
 *   apiKey: 'kc_your_api_key',
 * });
 * 
 * const { challenge } = await client.createChallenge({ ttl: 30 });
 * const response = client.generateResponse(challenge, 'hmac');
 * const result = await client.validateChallenge({ challenge, response });
 * ```
 */
export class KeyClaimClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly secret: string;
  private readonly axiosInstance: AxiosInstance;

  /**
   * Create a new KeyClaimClient instance
   * 
   * @param config - Configuration object or API key string
   * @param secret - Optional secret (only used if config is a string)
   */
  constructor(config: KeyClaimConfig | string, secret?: string) {
    // Decode default base URL from base64
    const defaultBaseUrl = Buffer.from(DEFAULT_BASE_URL_B64, 'base64').toString('utf-8');

    // Support both object config and legacy positional arguments
    if (typeof config === 'string') {
      this.apiKey = config;
      this.baseUrl = defaultBaseUrl;
      this.secret = secret || config; // Use API key as default secret
    } else {
      this.apiKey = config.apiKey;
      this.baseUrl = defaultBaseUrl;
      this.secret = config.secret || config.apiKey;
    }

    if (!this.apiKey || !this.apiKey.startsWith('kc_')) {
      throw new KeyClaimError('Invalid API key format. API key must start with "kc_"');
    }

    this.axiosInstance = axios.create({
      baseURL: `${this.baseUrl}/api`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      timeout: 30000,
    });
  }

  /**
   * Create a new challenge
   * 
   * @param options - Challenge creation options
   * @returns Challenge data
   * @throws {KeyClaimError} If the request fails
   * 
   * @example
   * ```typescript
   * const { challenge, expires_in } = await client.createChallenge({ ttl: 60 });
   * ```
   */
  async createChallenge(options: CreateChallengeOptions = {}): Promise<CreateChallengeResponse> {
    try {
      const response = await this.axiosInstance.post<CreateChallengeResponse>(
        '/challenge/create',
        {
          ttl: options.ttl || 30,
        }
      );

      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to create challenge');
    }
  }

  /**
   * Generate a response from a challenge using the specified method
   * 
   * @param challenge - The challenge string
   * @param method - Response generation method ('echo', 'hmac', 'hash', or 'custom')
   * @param customData - Optional custom data for 'custom' method
   * @returns Generated response string
   * @throws {KeyClaimError} If the method is invalid or custom data is missing
   * 
   * @example
   * ```typescript
   * // Using HMAC (recommended)
   * const response = client.generateResponse(challenge, 'hmac');
   * 
   * // Using echo (testing only)
   * const echoResponse = client.generateResponse(challenge, 'echo');
   * 
   * // Using custom data
   * const customResponse = client.generateResponse(challenge, 'custom', { userId: '123' });
   * ```
   */
  generateResponse(
    challenge: string,
    method: ResponseMethod = 'hmac',
    customData?: any
  ): string {
    switch (method) {
      case 'echo':
        return challenge;

      case 'hmac':
        return crypto
          .createHmac('sha256', this.secret)
          .update(challenge)
          .digest('hex');

      case 'hash':
        return crypto
          .createHash('sha256')
          .update(challenge + this.secret)
          .digest('hex');

      case 'custom':
        if (!customData) {
          throw new KeyClaimError('Custom data is required for custom method');
        }
        const data = typeof customData === 'string'
          ? `${challenge}:${customData}`
          : `${challenge}:${JSON.stringify(customData)}`;
        return crypto.createHash('sha256').update(data).digest('hex');

      default:
        throw new KeyClaimError(`Unknown response method: ${method}`);
    }
  }

  /**
   * Validate a challenge-response pair
   * 
   * @param options - Validation options
   * @returns Validation result
   * @throws {KeyClaimError} If the request fails (unless it's a validation failure)
   * 
   * @example
   * ```typescript
   * const result = await client.validateChallenge({
   *   challenge: challenge,
   *   response: response
   * });
   * 
   * if (result.valid) {
   *   console.log('Validation successful!');
   * }
   * ```
   */
  async validateChallenge(
    options: ValidateChallengeOptions
  ): Promise<ValidateChallengeResponse> {
    try {
      const response = await this.axiosInstance.post<ValidateChallengeResponse>(
        '/challenge/validate',
        {
          challenge: options.challenge,
          response: options.response,
          decryptedChallenge: options.decryptedChallenge,
        }
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<{ error?: string; valid?: boolean }>;
      
      // If the API returns a validation response (even if invalid), return it
      if (axiosError.response?.data && 'valid' in axiosError.response.data) {
        return {
          valid: false,
          error: axiosError.response.data.error || 'Validation failed',
        };
      }

      throw this.handleError(error, 'Failed to validate challenge');
    }
  }

  /**
   * Complete flow: create challenge, generate response, and validate
   * 
   * @param method - Response generation method (default: 'hmac')
   * @param ttl - Challenge TTL in seconds (default: 30)
   * @param customData - Optional custom data for 'custom' method
   * @returns Complete validation result
   * @throws {KeyClaimError} If any step fails
   * 
   * @example
   * ```typescript
   * // Complete flow with HMAC
   * const result = await client.validate('hmac', 30);
   * 
   * if (result.valid) {
   *   console.log('Validation successful!');
   * }
   * ```
   */
  async validate(
    method: ResponseMethod = 'hmac',
    ttl: number = 30,
    customData?: any
  ): Promise<ValidateChallengeResponse> {
    try {
      // Create challenge
      const { challenge } = await this.createChallenge({ ttl });

      // Generate response
      const response = this.generateResponse(challenge, method, customData);

      // Validate
      return await this.validateChallenge({ challenge, response });
    } catch (error) {
      throw this.handleError(error, 'Validation flow failed');
    }
  }

  /**
   * Handle errors and convert to KeyClaimError
   */
  private handleError(error: unknown, defaultMessage: string): KeyClaimError {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>;

    if (axiosError.response) {
      const statusCode = axiosError.response.status;
      const errorData = axiosError.response.data;
      const errorMessage = errorData?.error || errorData?.message || axiosError.message;

      return new KeyClaimError(
        errorMessage || defaultMessage,
        errorData?.error,
        statusCode
      );
    }

    if (axiosError.request) {
      return new KeyClaimError(
        'Network error: No response received from server',
        'network_error'
      );
    }

    return new KeyClaimError(
      axiosError.message || defaultMessage,
      'unknown_error'
    );
  }
}

/**
 * Create a new KeyClaimClient instance
 * 
 * @param config - Configuration object or API key string
 * @param secret - Optional secret (only used if config is a string)
 * @returns New KeyClaimClient instance
 * 
 * @example
 * ```typescript
 * import { createClient } from '@keyclaim/sdk-typescript';
 * 
 * const client = createClient({
 *   apiKey: 'kc_your_api_key',
 * });
 * ```
 */
export function createClient(
  config: KeyClaimConfig | string,
  secret?: string
): KeyClaimClient {
  return new KeyClaimClient(config, secret);
}

// Default export
export default KeyClaimClient;

