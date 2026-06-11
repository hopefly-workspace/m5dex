/**
 * Passkey (WebAuthn) utilities
 * Industry-standard passkey registration and support checks.
 */

const BASE64URL_REGEX = /^[A-Za-z0-9_-]+$/;

/**
 * Check if passkeys are supported in the current environment.
 * Requires HTTPS (or localhost) and PublicKeyCredential.
 */
export function isPasskeySupported() {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  if (!window.PublicKeyCredential) return false;
  if (typeof PublicKeyCredential !== 'function') return false;
  return true;
}

/**
 * Decode base64url string to Uint8Array.
 */
export function base64urlToBuffer(base64url) {
  if (!base64url || typeof base64url !== 'string') {
    throw new Error('Invalid base64url input');
  }
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const paddedStr = pad ? padded + '='.repeat(4 - pad) : padded;
  const binary = atob(paddedStr);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encode ArrayBuffer to base64url string.
 */
export function bufferToBase64url(buffer) {
  if (!buffer || !(buffer instanceof ArrayBuffer)) {
    throw new Error('Invalid buffer input');
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convert server-side PublicKeyCredentialCreationOptions to format expected by
 * navigator.credentials.create(). Decodes base64url fields to ArrayBuffer.
 */
export function prepareCreationOptions(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('Invalid creation options');
  }

  const prepared = { ...options };

  if (options.challenge) {
    prepared.challenge = typeof options.challenge === 'string'
      ? base64urlToBuffer(options.challenge)
      : options.challenge;
  }

  if (options.user && typeof options.user === 'object') {
    prepared.user = { ...options.user };
    if (typeof options.user.id === 'string') {
      prepared.user.id = base64urlToBuffer(options.user.id);
    }
  }

  if (Array.isArray(options.excludeCredentials)) {
    prepared.excludeCredentials = options.excludeCredentials.map((cred) => {
      const c = { ...cred };
      if (typeof cred.id === 'string') {
        c.id = base64urlToBuffer(cred.id);
      }
      return c;
    });
  }

  return prepared;
}

/**
 * Convert PublicKeyCredential to a JSON-serializable object for sending to the server.
 * Encodes ArrayBuffer fields to base64url.
 */
export function credentialToJSON(credential) {
  if (!credential || !credential.id) {
    throw new Error('Invalid credential');
  }

  const response = credential.response;
  if (!response || !response.clientDataJSON || !response.attestationObject) {
    throw new Error('Invalid credential response');
  }

  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
    },
  };
}

/**
 * Human-readable error messages for WebAuthn exceptions.
 */
export function getPasskeyErrorMessage(error) {
  if (!error) return 'Something went wrong.';

  const name = error.name || '';
  const msg = (error.message || '').toLowerCase();

  if (name === 'NotAllowedError') {
    if (msg.includes('cancel') || msg.includes('abort') || msg.includes('timeout')) {
      return 'Passkey setup was cancelled or timed out.';
    }
    return 'Permission denied. Use your device PIN, biometrics, or security key when prompted.';
  }

  if (name === 'InvalidStateError') {
    return 'A passkey for this account may already exist on this device. Try signing in with passkey instead.';
  }

  if (name === 'NotSupportedError') {
    return 'Passkeys are not supported in this browser. Use a modern browser (Chrome, Safari, Edge) on a secure connection.';
  }

  if (name === 'SecurityError') {
    return 'Passkeys require a secure context (HTTPS or localhost).';
  }

  if (name === 'AbortError') {
    return 'Passkey setup was cancelled.';
  }

  if (name === 'TypeError' && msg.includes('fetch')) {
    return 'Network error. Check your connection and try again.';
  }

  return error.message || 'Passkey setup failed. Please try again.';
}
