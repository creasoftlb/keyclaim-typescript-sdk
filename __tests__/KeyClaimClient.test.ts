import { KeyClaimClient, KeyClaimError, createClient } from '../src/index';
import axios from 'axios';
import * as crypto from 'crypto';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('KeyClaimClient', () => {
  const mockApiKey = 'kc_test123456789012345678901234567890123456789012345678901234567890';
  const mockSecret = 'test-secret-key';
  const mockBaseUrl = 'https://keyclaim.org';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue({
      post: jest.fn(),
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      request: jest.fn(),
      interceptors: {
        request: { use: jest.fn(), eject: jest.fn() },
        response: { use: jest.fn(), eject: jest.fn() },
      },
      defaults: {},
    } as any);
  });

  describe('Constructor', () => {
    it('should create client with object config', () => {
      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      expect(client).toBeInstanceOf(KeyClaimClient);
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: `${mockBaseUrl}/api`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockApiKey}`,
        },
        timeout: 30000,
      });
    });

    it('should create client with string apiKey and optional secret', () => {
      const client = new KeyClaimClient(mockApiKey, mockSecret);

      expect(client).toBeInstanceOf(KeyClaimClient);
      expect(mockedAxios.create).toHaveBeenCalled();
    });

    it('should use apiKey as default secret when not provided', () => {
      const client = new KeyClaimClient({
        apiKey: mockApiKey,
      });

      expect(client).toBeInstanceOf(KeyClaimClient);
      expect(mockedAxios.create).toHaveBeenCalled();
    });

    it('should throw error for invalid API key format', () => {
      expect(() => {
        new KeyClaimClient({
          apiKey: 'invalid-key',
        });
      }).toThrow(KeyClaimError);
    });

    it('should throw error for empty API key', () => {
      expect(() => {
        new KeyClaimClient({
          apiKey: '',
        });
      }).toThrow(KeyClaimError);
    });
  });

  describe('createChallenge', () => {
    it('should create challenge successfully', async () => {
      const mockResponse = {
        challenge: 'test-challenge-123',
        expires_in: 30,
        encrypted: false,
      };

      const mockAxiosInstance = {
        post: jest.fn().mockResolvedValue({ data: mockResponse }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      const result = await client.createChallenge({ ttl: 30 });

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/challenge/create', {
        ttl: 30,
      });
    });

    it('should use default ttl when not provided', async () => {
      const mockResponse = {
        challenge: 'test-challenge-123',
        expires_in: 30,
      };

      const mockAxiosInstance = {
        post: jest.fn().mockResolvedValue({ data: mockResponse }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      await client.createChallenge();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/challenge/create', {
        ttl: 30,
      });
    });

    it('should handle errors when creating challenge', async () => {
      const mockAxiosInstance = {
        post: jest.fn().mockRejectedValue({
          response: {
            status: 401,
            data: { error: 'Unauthorized' },
          },
        }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      await expect(client.createChallenge()).rejects.toThrow(KeyClaimError);
    });
  });

  describe('generateResponse', () => {
    let client: KeyClaimClient;

    beforeEach(() => {
      mockedAxios.create.mockReturnValue({
        post: jest.fn(),
      } as any);
      client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });
    });

    it('should generate echo response', () => {
      const challenge = 'test-challenge';
      const response = client.generateResponse(challenge, 'echo');

      expect(response).toBe(challenge);
    });

    it('should generate HMAC response', () => {
      const challenge = 'test-challenge';
      const response = client.generateResponse(challenge, 'hmac');

      const expectedHmac = crypto
        .createHmac('sha256', mockSecret)
        .update(challenge)
        .digest('hex');

      expect(response).toBe(expectedHmac);
      expect(response).toHaveLength(64); // SHA256 hex length
    });

    it('should generate hash response', () => {
      const challenge = 'test-challenge';
      const response = client.generateResponse(challenge, 'hash');

      const expectedHash = crypto
        .createHash('sha256')
        .update(challenge + mockSecret)
        .digest('hex');

      expect(response).toBe(expectedHash);
      expect(response).toHaveLength(64);
    });

    it('should generate custom response with string data', () => {
      const challenge = 'test-challenge';
      const customData = 'custom-string';
      const response = client.generateResponse(challenge, 'custom', customData);

      const expectedHash = crypto
        .createHash('sha256')
        .update(`${challenge}:${customData}`)
        .digest('hex');

      expect(response).toBe(expectedHash);
    });

    it('should generate custom response with object data', () => {
      const challenge = 'test-challenge';
      const customData = { userId: '123', timestamp: 1234567890 };
      const response = client.generateResponse(challenge, 'custom', customData);

      const expectedHash = crypto
        .createHash('sha256')
        .update(`${challenge}:${JSON.stringify(customData)}`)
        .digest('hex');

      expect(response).toBe(expectedHash);
    });

    it('should throw error for custom method without data', () => {
      const challenge = 'test-challenge';

      expect(() => {
        client.generateResponse(challenge, 'custom');
      }).toThrow(KeyClaimError);
    });

    it('should throw error for unknown method', () => {
      const challenge = 'test-challenge';

      expect(() => {
        client.generateResponse(challenge, 'unknown' as any);
      }).toThrow(KeyClaimError);
    });

    it('should default to hmac method', () => {
      const challenge = 'test-challenge';
      const response = client.generateResponse(challenge);

      const expectedHmac = crypto
        .createHmac('sha256', mockSecret)
        .update(challenge)
        .digest('hex');

      expect(response).toBe(expectedHmac);
    });
  });

  describe('validateChallenge', () => {
    it('should validate challenge successfully', async () => {
      const mockResponse = {
        valid: true,
        signature: 'test-signature',
        quota: {
          used: 10,
          remaining: 90,
          quota: 100,
        },
      };

      const mockAxiosInstance = {
        post: jest.fn().mockResolvedValue({ data: mockResponse }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      const result = await client.validateChallenge({
        challenge: 'test-challenge',
        response: 'test-response',
      });

      expect(result).toEqual(mockResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/challenge/validate', {
        challenge: 'test-challenge',
        response: 'test-response',
        decryptedChallenge: undefined,
      });
    });

    it('should include decryptedChallenge when provided', async () => {
      const mockResponse = {
        valid: true,
      };

      const mockAxiosInstance = {
        post: jest.fn().mockResolvedValue({ data: mockResponse }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      await client.validateChallenge({
        challenge: 'test-challenge',
        response: 'test-response',
        decryptedChallenge: 'decrypted-challenge',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/challenge/validate', {
        challenge: 'test-challenge',
        response: 'test-response',
        decryptedChallenge: 'decrypted-challenge',
      });
    });

    it('should return validation result when API returns invalid response', async () => {
      const mockAxiosInstance = {
        post: jest.fn().mockRejectedValue({
          response: {
            status: 400,
            data: {
              valid: false,
              error: 'Invalid response',
            },
          },
        }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      const result = await client.validateChallenge({
        challenge: 'test-challenge',
        response: 'test-response',
      });

      expect(result).toEqual({
        valid: false,
        error: 'Invalid response',
      });
    });

    it('should return validation result when API returns invalid response without error field', async () => {
      const mockAxiosInstance = {
        post: jest.fn().mockRejectedValue({
          response: {
            status: 400,
            data: {
              valid: false,
            },
          },
        }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      const result = await client.validateChallenge({
        challenge: 'test-challenge',
        response: 'test-response',
      });

      expect(result).toEqual({
        valid: false,
        error: 'Validation failed',
      });
    });

    it('should throw error for network errors', async () => {
      const mockAxiosInstance = {
        post: jest.fn().mockRejectedValue({
          request: {},
          message: 'Network Error',
        }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      await expect(
        client.validateChallenge({
          challenge: 'test-challenge',
          response: 'test-response',
        })
      ).rejects.toThrow(KeyClaimError);
    });
  });

  describe('validate', () => {
    it('should complete full validation flow', async () => {
      const mockChallenge = 'test-challenge-123';
      const mockValidationResponse = {
        valid: true,
        signature: 'test-signature',
        quota: {
          used: 5,
          remaining: 95,
          quota: 100,
        },
      };

      const mockAxiosInstance = {
        post: jest.fn()
          .mockResolvedValueOnce({
            data: {
              challenge: mockChallenge,
              expires_in: 30,
            },
          })
          .mockResolvedValueOnce({
            data: mockValidationResponse,
          }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      const result = await client.validate('hmac', 30);

      expect(result).toEqual(mockValidationResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('should use default method and ttl', async () => {
      const mockChallenge = 'test-challenge-123';
      const mockValidationResponse = {
        valid: true,
      };

      const mockAxiosInstance = {
        post: jest.fn()
          .mockResolvedValueOnce({
            data: {
              challenge: mockChallenge,
              expires_in: 30,
            },
          })
          .mockResolvedValueOnce({
            data: mockValidationResponse,
          }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      await client.validate();

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('should handle errors in validation flow', async () => {
      const mockAxiosInstance = {
        post: jest.fn().mockRejectedValue({
          response: {
            status: 500,
            data: { error: 'Server error' },
          },
        }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      await expect(client.validate()).rejects.toThrow(KeyClaimError);
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP errors with status code', async () => {
      const mockAxiosInstance = {
        post: jest.fn().mockRejectedValue({
          response: {
            status: 403,
            data: { error: 'Forbidden', message: 'Access denied' },
          },
        }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      try {
        await client.createChallenge();
      } catch (error) {
        expect(error).toBeInstanceOf(KeyClaimError);
        expect((error as KeyClaimError).statusCode).toBe(403);
        expect((error as KeyClaimError).code).toBe('Forbidden');
      }
    });

    it('should handle network errors', async () => {
      const mockAxiosInstance = {
        post: jest.fn().mockRejectedValue({
          request: {},
          message: 'Network timeout',
        }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      try {
        await client.createChallenge();
      } catch (error) {
        expect(error).toBeInstanceOf(KeyClaimError);
        expect((error as KeyClaimError).code).toBe('network_error');
      }
    });

    it('should handle unknown errors', async () => {
      const mockAxiosInstance = {
        post: jest.fn().mockRejectedValue(new Error('Unknown error')),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      try {
        await client.createChallenge();
      } catch (error) {
        expect(error).toBeInstanceOf(KeyClaimError);
        expect((error as KeyClaimError).code).toBe('unknown_error');
        expect((error as KeyClaimError).message).toBe('Unknown error');
      }
    });

    it('should handle unknown errors without message', async () => {
      const mockAxiosInstance = {
        post: jest.fn().mockRejectedValue({}),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      try {
        await client.createChallenge();
      } catch (error) {
        expect(error).toBeInstanceOf(KeyClaimError);
        expect((error as KeyClaimError).code).toBe('unknown_error');
        expect((error as KeyClaimError).message).toBe('Failed to create challenge');
      }
    });

    it('should handle HTTP errors with message field', async () => {
      const mockAxiosInstance = {
        post: jest.fn().mockRejectedValue({
          response: {
            status: 500,
            data: { message: 'Server error message' },
          },
        }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      try {
        await client.createChallenge();
      } catch (error) {
        expect(error).toBeInstanceOf(KeyClaimError);
        expect((error as KeyClaimError).message).toBe('Server error message');
        expect((error as KeyClaimError).statusCode).toBe(500);
      }
    });

    it('should handle HTTP errors with axios message when no error/message in data', async () => {
      const axiosError = {
        response: {
          status: 401,
          data: {},
        },
        message: 'Unauthorized request',
      };

      const mockAxiosInstance = {
        post: jest.fn().mockRejectedValue(axiosError),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      try {
        await client.createChallenge();
      } catch (error) {
        expect(error).toBeInstanceOf(KeyClaimError);
        expect((error as KeyClaimError).message).toBe('Unauthorized request');
        expect((error as KeyClaimError).statusCode).toBe(401);
      }
    });

    it('should handle HTTP errors with default message when no error/message available', async () => {
      const mockAxiosInstance = {
        post: jest.fn().mockRejectedValue({
          response: {
            status: 404,
            data: {},
          },
        }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const client = new KeyClaimClient({
        apiKey: mockApiKey,
        secret: mockSecret,
      });

      try {
        await client.createChallenge();
      } catch (error) {
        expect(error).toBeInstanceOf(KeyClaimError);
        expect((error as KeyClaimError).message).toBe('Failed to create challenge');
        expect((error as KeyClaimError).statusCode).toBe(404);
      }
    });
  });
});

describe('KeyClaimError', () => {
  it('should create error with message', () => {
    const error = new KeyClaimError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('KeyClaimError');
  });

  it('should create error with code and statusCode', () => {
    const error = new KeyClaimError('Test error', 'test_code', 404);
    expect(error.code).toBe('test_code');
    expect(error.statusCode).toBe(404);
  });
});

describe('createClient', () => {
  it('should create client instance', () => {
    mockedAxios.create.mockReturnValue({
      post: jest.fn(),
    } as any);

    const client = createClient({
      apiKey: 'kc_test123456789012345678901234567890123456789012345678901234567890',
    });

    expect(client).toBeInstanceOf(KeyClaimClient);
  });

  it('should create client with string apiKey', () => {
    mockedAxios.create.mockReturnValue({
      post: jest.fn(),
    } as any);

    const client = createClient('kc_test123456789012345678901234567890123456789012345678901234567890');

    expect(client).toBeInstanceOf(KeyClaimClient);
  });
});

