/**
 * Industry-grade copy-to-clipboard utility.
 * Works on HTTP (non-secure), HTTPS, localhost, and older browsers.
 *
 * navigator.clipboard.writeText() only works in secure contexts (HTTPS/localhost).
 * On HTTP production sites it fails silently. This utility falls back to
 * execCommand('copy') which works everywhere when triggered by user gesture.
 */

/**
 * Copy text to clipboard.
 * @param {string} text - Text to copy
 * @returns {Promise<void>} Resolves on success, rejects on failure
 */
export async function copyToClipboard(text) {
  const str = String(text ?? '');

  // Use modern Clipboard API when available and in secure context (HTTPS/localhost)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(str);
      return;
    } catch (err) {
      // Fall through to execCommand fallback (e.g. permission denied, etc.)
    }
  }

  // Fallback: execCommand works on HTTP and older browsers when called from user gesture
  return fallbackCopy(str);
}

function fallbackCopy(text) {
  return new Promise((resolve, reject) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Prevent scrolling and visibility (screen readers may still announce)
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');

    // iOS requires a non-zero font-size to prevent zoom on focus
    textArea.style.fontSize = '12pt';

    document.body.appendChild(textArea);

    // iOS: select differently to avoid scrolling
    if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
      const range = document.createRange();
      range.selectNodeContents(textArea);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      textArea.select();
    }

    try {
      const ok = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (ok) {
        resolve();
      } else {
        reject(new Error('Copy command failed'));
      }
    } catch (err) {
      document.body.removeChild(textArea);
      reject(err);
    }
  });
}
