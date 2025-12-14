# KeyClaim TypeScript SDK

Official KeyClaim SDK for TypeScript - MITM protection and challenge validation with full type safety.

## Installation

```bash
npm install @keyclaim/sdk-typescript
```

## Quick Start

```typescript
import { KeyClaimClient } from '@keyclaim/sdk-typescript';

// Initialize client (base URL is automatically set)
const client = new KeyClaimClient({
  apiKey: 'kc_your_api_key_here',
});

// Complete validation flow
async function main() {
  try {
    // Create challenge, generate response, and validate in one call
    const result = await client.validate('hmac', 30);
    
    if (result.valid) {
      console.log('✓ Validation successful!');
      console.log('Signature:', result.signature);
      console.log('Quota:', result.quota);
    } else {
      console.log('✗ Validation failed:', result.error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
```

## Step-by-Step Usage

### 1. Create a Challenge

```typescript
const { challenge, expires_in } = await client.createChallenge({ ttl: 30 });
console.log('Challenge:', challenge);
```

### 2. Generate Response

```typescript
// Using HMAC (recommended)
const response = client.generateResponse(challenge, 'hmac');

// Or using other methods
const echoResponse = client.generateResponse(challenge, 'echo');
const hashResponse = client.generateResponse(challenge, 'hash');
```

### 3. Validate Challenge

```typescript
const result = await client.validateChallenge({
  challenge: challenge,
  response: response
});

if (result.valid) {
  console.log('Validation successful!');
} else {
  console.log('Validation failed:', result.error);
}
```

## TypeScript Types

The SDK includes comprehensive TypeScript types:

```typescript
import {
  KeyClaimClient,
  KeyClaimConfig,
  CreateChallengeOptions,
  CreateChallengeResponse,
  ValidateChallengeOptions,
  ValidateChallengeResponse,
  ResponseMethod,
  KeyClaimError
} from '@keyclaim/sdk-typescript';
```

## API Reference

### `KeyClaimClient`

#### Constructor

```typescript
new KeyClaimClient(config: KeyClaimConfig | string, secret?: string)
```

**Parameters:**
- `config` (object or string):
  - `apiKey` (string, required): Your KeyClaim API key (must start with `kc_`)
  - `secret` (string, optional): Secret for HMAC generation (default: API key)
- Or positional arguments:
  - `apiKey` (string, required): Your KeyClaim API key
  - `secret` (string, optional): Secret for HMAC generation

**Note:** The base URL is automatically set to `https://keyclaim.org` and cannot be overridden.

**Example:**
```typescript
// Using object config
const client = new KeyClaimClient({
  apiKey: 'kc_your_api_key',
  secret: 'your-secret'
});

// Using positional arguments
const client = new KeyClaimClient('kc_your_api_key', 'your-secret');
```

#### Methods

##### `createChallenge(options?)`

Create a new challenge.

**Parameters:**
- `options` (object, optional):
  - `ttl` (number, optional): Time to live in seconds (default: 30)

**Returns:** `Promise<CreateChallengeResponse>`

**Example:**
```typescript
const { challenge, expires_in } = await client.createChallenge({ ttl: 60 });
```

##### `generateResponse(challenge, method?, customData?)`

Generate a response from a challenge.

**Parameters:**
- `challenge` (string, required): The challenge string
- `method` (string, optional): Response method - `'echo'`, `'hmac'`, `'hash'`, or `'custom'` (default: `'hmac'`)
- `customData` (any, optional): Custom data for `'custom'` method

**Returns:** `string`

**Example:**
```typescript
const response = client.generateResponse(challenge, 'hmac');
```

##### `validateChallenge(options)`

Validate a challenge-response pair.

**Parameters:**
- `options` (object, required):
  - `challenge` (string, required): The challenge string
  - `response` (string, required): The generated response
  - `decryptedChallenge` (string, optional): Decrypted challenge if encrypted

**Returns:** `Promise<ValidateChallengeResponse>`

**Example:**
```typescript
const result = await client.validateChallenge({
  challenge: challenge,
  response: response
});
```

##### `validate(method?, ttl?, customData?)`

Complete validation flow: create challenge, generate response, and validate.

**Parameters:**
- `method` (string, optional): Response method (default: `'hmac'`)
- `ttl` (number, optional): Challenge TTL in seconds (default: 30)
- `customData` (any, optional): Custom data for `'custom'` method

**Returns:** `Promise<ValidateChallengeResponse>`

**Example:**
```typescript
const result = await client.validate('hmac', 30);
```

## Response Methods

### Echo (Testing Only)
```typescript
const response = client.generateResponse(challenge, 'echo');
// Returns the challenge as-is
```

### HMAC-SHA256 (Recommended)
```typescript
const response = client.generateResponse(challenge, 'hmac');
// Returns HMAC-SHA256 hash of challenge using secret
```

### SHA256 Hash
```typescript
const response = client.generateResponse(challenge, 'hash');
// Returns SHA256 hash of challenge + secret
```

### Custom
```typescript
const response = client.generateResponse(challenge, 'custom', {
  userId: '123',
  timestamp: Date.now()
});
// Returns SHA256 hash of challenge + custom data
```

## Error Handling

The SDK throws `KeyClaimError` for all errors:

```typescript
import { KeyClaimClient, KeyClaimError } from '@keyclaim/sdk-typescript';

try {
  const result = await client.validate();
} catch (error) {
  if (error instanceof KeyClaimError) {
    console.error('KeyClaim Error:', error.message);
    console.error('Code:', error.code);
    console.error('Status:', error.statusCode);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Examples

### Basic Validation

```typescript
import { KeyClaimClient } from '@keyclaim/sdk-typescript';

const client = new KeyClaimClient('kc_your_api_key');

async function validate() {
  const result = await client.validate('hmac');
  console.log('Valid:', result.valid);
}
```

### Custom Response Generation

```typescript
const client = new KeyClaimClient('kc_your_api_key');

const { challenge } = await client.createChallenge();
const response = client.generateResponse(challenge, 'custom', {
  userId: 'user123',
  timestamp: Date.now()
});
const result = await client.validateChallenge({ challenge, response });
```

### Error Handling with Retry

```typescript
async function createChallengeWithRetry(maxRetries = 3): Promise<CreateChallengeResponse> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.createChallenge();
    } catch (error) {
      if (error instanceof KeyClaimError && error.statusCode === 401) {
        throw new Error('Invalid API key');
      }
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Type Definitions

All types are exported for use in your TypeScript projects:

```typescript
import type {
  KeyClaimConfig,
  CreateChallengeOptions,
  CreateChallengeResponse,
  ValidateChallengeOptions,
  ValidateChallengeResponse,
  ResponseMethod
} from '@keyclaim/sdk-typescript';
```

## License

MIT

## Support

- Documentation: https://keyclaim.org/docs
- Issues: https://github.com/creasoftlb/keyclaim-typescript-sdk/issues

