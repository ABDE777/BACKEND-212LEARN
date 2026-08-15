import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { getAppSettings, updateAppSettings } from '../utils/settings.js';

// Fields an admin may edit via PATCH /admin/settings. `id`/`updatedAt` excluded.
const STRING_FIELDS = ['siteName', 'supportEmail', 'currency'];
const BOOL_FIELDS = [
  'wafacashAutoApprove', 'requireKyc', 'allowRegistrations',
  'maintenanceMode', 'emailNotifications',
];

// GET /api/v1/admin/settings
export const getSettings = async (req, res, next) => {
  try {
    const settings = await getAppSettings();
    res.status(200).json(successResponse({ settings }));
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/admin/settings
export const updateSettings = async (req, res, next) => {
  try {
    const patch = {};
    for (const key of STRING_FIELDS) {
      if (req.body[key] !== undefined) {
        if (typeof req.body[key] !== 'string') {
          return next(new AppError(`${key} must be a string.`, 400, 'VALIDATION_ERROR'));
        }
        patch[key] = req.body[key].trim();
      }
    }
    for (const key of BOOL_FIELDS) {
      if (req.body[key] !== undefined) patch[key] = Boolean(req.body[key]);
    }

    if (Object.keys(patch).length === 0) {
      return next(new AppError('No valid settings fields provided.', 400, 'VALIDATION_ERROR'));
    }

    const settings = await updateAppSettings(patch);
    res.status(200).json(successResponse({ settings }));
  } catch (error) {
    next(error);
  }
};
