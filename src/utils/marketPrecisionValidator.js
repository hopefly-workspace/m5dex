const CRYPTO_DECIMALS_BY_ASSET = {
  major: 4,
  altcoin: 2,
  stablecoin: 2,
  default: 4,
};

const MARKET_STEPS = {
  crypto: '0.0001',
  forex: '0.000001',
  indian_fo: '1',
};

const MARKET_PATTERNS = {
  crypto_4: /^\d+(\.\d{1,4})?$/,
  crypto_2: /^\d+(\.\d{1,2})?$/,
  forex: /^\d+(\.\d{1,6})?$/,
  indian_fo: /^\d+$/,
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeInput = (value) => String(value ?? '').trim().replace(/[\s,]/g, '');

const trimZeros = (raw) => {
  if (!raw.includes('.')) return raw;
  return raw.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '').replace(/\.$/, '');
};

const clampDecimals = (raw, maxDecimals) => {
  if (!raw.includes('.')) return raw;
  const [intPart, fracPart = ''] = raw.split('.');
  if (fracPart.length <= maxDecimals) return raw;
  return `${intPart}.${fracPart.slice(0, maxDecimals)}`;
};

/** Indian market lot count: digits only, no fractional lots (strip at decimal point). */
const sanitizeIntegerTyping = (value) => {
  const normalized = normalizeInput(value);
  if (!normalized) return '';
  return normalized.split('.')[0].replace(/[^\d]/g, '');
};

const sanitizeNumericTyping = (value, maxDecimals, allowDecimal = true) => {
  if (!allowDecimal) return sanitizeIntegerTyping(value);
  let cleaned = normalizeInput(value).replace(/[^\d.]/g, '');
  if (!cleaned) return '';
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, '')}`;
  }
  if (cleaned.startsWith('.')) cleaned = `0${cleaned}`;
  return clampDecimals(cleaned, maxDecimals);
};

const getCryptoDecimals = (assetType) => {
  const key = String(assetType || 'default').toLowerCase();
  return CRYPTO_DECIMALS_BY_ASSET[key] ?? CRYPTO_DECIMALS_BY_ASSET.default;
};

export const getMarketPrecisionMeta = (marketType, options = {}) => {
  if (marketType === 'crypto') {
    const maxDecimals = getCryptoDecimals(options.assetType);
    return {
      maxDecimals,
      step: maxDecimals <= 2 ? '0.01' : '0.0001',
      inputMode: 'decimal',
      pattern: maxDecimals <= 2 ? MARKET_PATTERNS.crypto_2 : MARKET_PATTERNS.crypto_4.source,
    };
  }
  if (marketType === 'forex') {
    return { maxDecimals: 6, step: MARKET_STEPS.forex, inputMode: 'decimal', pattern: MARKET_PATTERNS.forex.source };
  }
  return {
    maxDecimals: 0,
    step: MARKET_STEPS.indian_fo,
    inputMode: 'numeric',
    pattern: MARKET_PATTERNS.indian_fo.source,
  };
};

export const sanitizeQuantityForTyping = (value, marketType, options = {}) => {
  if (marketType === 'indian_fo') return sanitizeIntegerTyping(value);
  const { maxDecimals } = getMarketPrecisionMeta(marketType, options);
  return sanitizeNumericTyping(value, maxDecimals, true);
};

/** Parsed lot count for Indian F&O (positive integer or null). */
export const parseIndianLotCount = (value) => {
  const raw = sanitizeIntegerTyping(value);
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function validateQuantity(value, marketType, options = {}) {
  const meta = getMarketPrecisionMeta(marketType, options);
  const rawForCheck =
    marketType === 'indian_fo'
      ? sanitizeIntegerTyping(value)
      : sanitizeNumericTyping(value, 16, true);
  const raw = sanitizeQuantityForTyping(value, marketType, options);
  const normalized = normalizeInput(raw);

  if (normalized === '') {
    return {
      isValid: true,
      sanitizedValue: normalized,
      errorMessage: null,
      maxDecimals: meta.maxDecimals,
      step: meta.step,
    };
  }

  if (marketType === 'crypto') {
    const rawFractionLength = rawForCheck.includes('.') ? rawForCheck.split('.')[1].length : 0;
    if (rawFractionLength > meta.maxDecimals) {
      return {
        isValid: false,
        sanitizedValue: clampDecimals(rawForCheck, meta.maxDecimals),
        errorMessage: `Max ${meta.maxDecimals} decimal places allowed for ${options.assetLabel || options.assetType || 'asset'}`,
        maxDecimals: meta.maxDecimals,
        step: meta.step,
      };
    }
    const pattern = meta.maxDecimals <= 2 ? MARKET_PATTERNS.crypto_2 : MARKET_PATTERNS.crypto_4;
    if (!pattern.test(normalized)) {
      return {
        isValid: false,
        sanitizedValue: clampDecimals(normalized, meta.maxDecimals),
        errorMessage: `Max ${meta.maxDecimals} decimal places allowed for ${options.assetLabel || options.assetType || 'asset'}`,
        maxDecimals: meta.maxDecimals,
        step: meta.step,
      };
    }
    const parsed = toNumber(normalized);
    if (parsed == null || parsed <= 0) {
      return {
        isValid: false,
        sanitizedValue: parsed == null ? '' : trimZeros(normalized),
        errorMessage: 'Quantity must be greater than 0',
        maxDecimals: meta.maxDecimals,
        step: meta.step,
      };
    }
    return {
      isValid: true,
      sanitizedValue: normalized,
      errorMessage: null,
      maxDecimals: meta.maxDecimals,
      step: meta.step,
    };
  }

  if (marketType === 'forex') {
    const rawFractionLength = rawForCheck.includes('.') ? rawForCheck.split('.')[1].length : 0;
    if (rawFractionLength > 6) {
      return {
        isValid: false,
        sanitizedValue: clampDecimals(rawForCheck, 6),
        errorMessage: 'Lot allows up to 6 decimal places',
        maxDecimals: meta.maxDecimals,
        step: meta.step,
      };
    }
    const parsed = toNumber(normalized);
    const maxLot = Number.isFinite(options.maxLot) ? Number(options.maxLot) : 100;
    if (!MARKET_PATTERNS.forex.test(normalized)) {
      return {
        isValid: false,
        sanitizedValue: clampDecimals(normalized, 6),
        errorMessage: 'Lot allows up to 6 decimal places',
        maxDecimals: meta.maxDecimals,
        step: meta.step,
      };
    }
    if (parsed == null || parsed <= 0) {
      return {
        isValid: false,
        sanitizedValue: '',
        errorMessage: 'Lot must be greater than 0',
        maxDecimals: meta.maxDecimals,
        step: meta.step,
      };
    }
    if (parsed > maxLot) {
      return {
        isValid: false,
        sanitizedValue: String(maxLot),
        errorMessage: `Maximum lot size is ${maxLot}`,
        maxDecimals: meta.maxDecimals,
        step: meta.step,
      };
    }
    return {
      isValid: true,
      sanitizedValue: trimZeros(normalized),
      errorMessage: null,
      maxDecimals: meta.maxDecimals,
      step: meta.step,
    };
  }

  const originalNormalized = normalizeInput(value);
  if (originalNormalized.includes('.') || rawForCheck.includes('.')) {
    const intOnly = sanitizeIntegerTyping(value);
    return {
      isValid: false,
      sanitizedValue: intOnly,
      errorMessage: 'Lot size must be a whole number (no decimals)',
      maxDecimals: meta.maxDecimals,
      step: meta.step,
    };
  }
  if (!MARKET_PATTERNS.indian_fo.test(normalized)) {
    return {
      isValid: false,
      sanitizedValue: sanitizeIntegerTyping(value),
      errorMessage: 'Lot size must be a whole number (no decimals)',
      maxDecimals: meta.maxDecimals,
      step: meta.step,
    };
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      isValid: false,
      sanitizedValue: parsed === 0 ? '' : String(parsed),
      errorMessage: 'Lot size must be greater than 0',
      maxDecimals: meta.maxDecimals,
      step: meta.step,
    };
  }
  const maxLots = Number(options.maxLots);
  if (Number.isFinite(maxLots) && maxLots > 0 && parsed > maxLots) {
    return {
      isValid: false,
      sanitizedValue: String(Math.floor(maxLots)),
      errorMessage: `Maximum lot size is ${Math.floor(maxLots)}`,
      maxDecimals: meta.maxDecimals,
      step: meta.step,
    };
  }
  return {
    isValid: true,
    sanitizedValue: String(parsed),
    errorMessage: null,
    maxDecimals: meta.maxDecimals,
    step: meta.step,
  };
}
