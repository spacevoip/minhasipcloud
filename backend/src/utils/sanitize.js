// Shared sanitization helper for user objects across routes
// Removes sensitive fields from user objects before sending responses.

const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'reset_token',
  'two_factor_secret',
  'twoFactorSecret',
  'otp_secret',
  'otpSecret'
];

function sanitizeUserOutput(entity) {
  if (!entity) return entity;

  if (Array.isArray(entity)) {
    return entity.map((item) => sanitizeUserOutput(item));
  }

  if (typeof entity === 'object') {
    // If it's a model instance with toJSON, use it to get plain object
    const plain = typeof entity.toJSON === 'function' ? entity.toJSON() : { ...entity };
    for (const field of SENSITIVE_FIELDS) {
      if (field in plain) delete plain[field];
    }
    return plain;
  }

  return entity;
}

module.exports = {
  sanitizeUserOutput,
  SENSITIVE_FIELDS,
};
