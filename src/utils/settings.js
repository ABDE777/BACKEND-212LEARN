import prisma from '../config/prisma.js';

// The settings are a singleton row (id = "app"). They're read on hot paths
// (every request passes the maintenance gate), so cache the row briefly to
// avoid a DB round-trip per request. Writes clear the cache immediately.
const SINGLETON_ID = 'app';
const CACHE_TTL_MS = 15000;

let cache = null;
let cachedAt = 0;

const DEFAULTS = {
  siteName: '212 Learn',
  supportEmail: 'support@212learn.com',
  currency: 'MAD',
  wafacashAutoApprove: false,
  requireKyc: true,
  allowRegistrations: true,
  maintenanceMode: false,
  emailNotifications: true,
  instructorSharePct: 70,
};

/**
 * Return the platform settings singleton, creating it with defaults if missing.
 * Falls back to DEFAULTS if the table doesn't exist yet (pre-migration), so the
 * app never hard-fails on a settings read.
 */
export const getAppSettings = async () => {
  if (cache && Date.now() - cachedAt < CACHE_TTL_MS) return cache;
  try {
    const row = await prisma.appSetting.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
    cache = row;
    cachedAt = Date.now();
    return row;
  } catch {
    // Table not migrated yet, or DB hiccup — degrade to safe defaults.
    return { id: SINGLETON_ID, ...DEFAULTS };
  }
};

/** Patch the singleton with an allow-listed subset and refresh the cache. */
export const updateAppSettings = async (patch) => {
  const row = await prisma.appSetting.upsert({
    where: { id: SINGLETON_ID },
    update: patch,
    create: { id: SINGLETON_ID, ...patch },
  });
  cache = row;
  cachedAt = Date.now();
  return row;
};

export const clearSettingsCache = () => { cache = null; cachedAt = 0; };
