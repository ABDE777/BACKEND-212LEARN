/**
 * Uniform API response helpers.
 * All responses follow this envelope:
 *
 *   Success:  { success: true,  data: ...,  meta: ... }
 *   Error:    { success: false, error: { code: '...', message: '...' } }
 */

/**
 * Build a successful response object.
 * @param {*}      data     - The payload to return.
 * @param {object} [meta]   - Optional pagination / extra metadata.
 */
export const successResponse = (data, meta = undefined) => ({
  success: true,
  ...(meta ? { meta } : {}),
  data,
});

/**
 * Build an error response object.
 * @param {string} message  - Human-readable message.
 * @param {string} [code]   - Machine-readable error code (e.g. 'VALIDATION_ERROR').
 */
export const errorResponse = (message, code = 'INTERNAL_ERROR') => ({
  success: false,
  error: { code, message },
});

/**
 * Build pagination metadata.
 * Supports standard pagination and "fetch all" mode when pagination is disabled.
 * @param {number} total              - Total number of records.
 * @param {number} page               - Current page (1-indexed).
 * @param {number|null} limit         - Page size, or null when pagination is disabled.
 * @param {boolean} [isUnlimited]     - True when the caller requested all records.
 */
export const paginationMeta = (total, page, limit, isUnlimited = false) => {
  const effectivePage = isUnlimited ? 1 : page;
  const effectiveLimit = isUnlimited ? total : limit;
  const totalPages = isUnlimited
    ? (total > 0 ? 1 : 0)
    : Math.ceil(total / limit);

  return {
    total,
    totalItems: total,
    page: effectivePage,
    limit: effectiveLimit,
    totalPages,
    hasNextPage: !isUnlimited && effectivePage < totalPages,
    hasPrevPage: !isUnlimited && effectivePage > 1,
  };
};

/**
 * Parse and validate pagination query params from the request.
 * Defaults: page=1, limit=20, max limit=100.
 * Special case: limit=0 or limit=-1 disables pagination (dev / explicit allow only).
 * In production, unlimited fetch is blocked unless ALLOW_UNLIMITED_PAGINATION=true.
 */
export const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const rawLimit = parseInt(query.limit, 10);

  if (rawLimit === 0 || rawLimit === -1) {
    const allowUnlimited =
      process.env.ALLOW_UNLIMITED_PAGINATION === 'true' ||
      process.env.NODE_ENV !== 'production';

    if (!allowUnlimited) {
      // Fall back to max page size instead of dumping entire tables
      const limit = 100;
      const skip = (page - 1) * limit;
      return { page, limit, skip, isUnlimited: false };
    }

    return { page: 1, limit: null, skip: undefined, isUnlimited: true };
  }

  const limit = Math.min(100, Math.max(1, rawLimit || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip, isUnlimited: false };
};

/**
 * Parse sort / order query params.
 * @param {object} query           - req.query
 * @param {string[]} allowedFields - Fields that can be sorted on.
 * @param {string} defaultField    - Default sort field.
 * @returns {{ [field]: 'asc' | 'desc' }}
 */
export const parseSort = (query, allowedFields, defaultField = 'createdAt') => {
  const field = allowedFields.includes(query.sort) ? query.sort : defaultField;
  const order = query.order === 'asc' ? 'asc' : 'desc';
  return { [field]: order };
};
