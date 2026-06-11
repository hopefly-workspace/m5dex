/**
 * Passkey (WebAuthn) API service
 * Handles registration and removal via backend.
 */

import api from './api';
import {
  isPasskeySupported,
  prepareCreationOptions,
  credentialToJSON,
  getPasskeyErrorMessage,
} from '../utils/passkey';

const PASSKEY_OPTIONS_URL = '/auth/passkey/register/options';
const PASSKEY_REGISTER_URL = '/auth/passkey/register';
const PASSKEY_REMOVE_URL = '/auth/passkey';

/**
 * Check passkey support. Throws with a user-friendly message if not supported.
 */
export function checkPasskeySupport() {
  if (!isPasskeySupported()) {
    throw new Error(
      'Passkeys are not supported. Use a modern browser (Chrome, Safari, Edge) over HTTPS.'
    );
  }
}

/**
 * Register a new passkey for the current user.
 * 1. Fetch creation options from backend
 * 2. Create credential via WebAuthn
 * 3. Send credential to backend for verification and storage
 *
 * @returns {Promise<void>}
 * @throws {Error} On support, network, or WebAuthn errors
 */
export async function registerPasskey() {
  checkPasskeySupport();

  let optionsRes;
  try {
    optionsRes = await api.post(PASSKEY_OPTIONS_URL, {});
  } catch (e) {
    const msg = e?.data?.message || e?.message || 'Could not start passkey setup.';
    throw new Error(msg);
  }

  const optionsPayload = optionsRes?.data ?? optionsRes;
  if (!optionsPayload) {
    throw new Error('Invalid passkey options from server.');
  }

  let options;
  try {
    options = prepareCreationOptions(optionsPayload);
  } catch (e) {
    throw new Error('Invalid passkey options format.');
  }

  let credential;
  try {
    credential = await navigator.credentials.create({
      publicKey: options,
    });
  } catch (e) {
    throw new Error(getPasskeyErrorMessage(e));
  }

  if (!credential) {
    throw new Error('Passkey creation was cancelled.');
  }

  const body = credentialToJSON(credential);

  try {
    await api.post(PASSKEY_REGISTER_URL, body);
  } catch (e) {
    const msg = e?.data?.message || e?.message || 'Could not save passkey. Please try again.';
    throw new Error(msg);
  }
}

/**
 * Remove passkey for the current user.
 *
 * @returns {Promise<void>}
 * @throws {Error} On network or server errors
 */
export async function removePasskey() {
  try {
    await api.delete(PASSKEY_REMOVE_URL);
  } catch (e) {
    const msg = e?.data?.message || e?.message || 'Could not remove passkey. Please try again.';
    throw new Error(msg);
  }
}
