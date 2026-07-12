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
 * @param {number} total  - Total number of records.
 * @param {number} page   - Current page (1-indexed).
 * @param {number} limit  - Page size.
 */
export const paginationMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
});

/**
 * Parse and validate pagination query params from the request.
 * Defaults: page=1, limit=20, max limit=100.
 * @param {object} query - req.query
 * @returns {{ page: number, limit: number, skip: number }}
 */
export const parsePagination = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
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
