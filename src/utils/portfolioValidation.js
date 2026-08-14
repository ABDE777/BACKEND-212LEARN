import { AppError } from '../middleware/error.js';
import { validateHttpUrl } from './validation.js';
import { isOurCloudinaryUrl } from '../config/cloudinary.js';

// ─── Portfolio vocabularies & caps ────────────────────────────────────────────
// Shared by learners and instructors. Kept small and server-enforced so a
// tampered client can't store junk, oversized blobs, or hostile URLs.
export const LANGUAGE_LEVELS = ['basic', 'intermediate', 'fluent', 'native'];
export const SOCIAL_KEYS = ['linkedin', 'github', 'website', 'twitter'];

const CAP = { skills: 30, languages: 20, certifications: 20, diplomas: 20 };
const MAX_SKILL_LEN = 50;
const MAX_TEXT_LEN = 150;
const MIN_YEAR = 1950;
const MAX_YEAR = new Date().getFullYear() + 1;

const bad = (msg) => new AppError(msg, 400, 'VALIDATION_ERROR');

const cleanStr = (v, max, field) => {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') throw bad(`${field} must be text.`);
  const trimmed = v.trim();
  if (trimmed.length > max) throw bad(`${field} must be ${max} characters or fewer.`);
  return trimmed;
};

// A file URL, when present, must be one of OUR Cloudinary URLs — never an
// arbitrary link (blocks storing a phishing URL an admin/peer might click).
const cleanFileUrl = (v, field) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw bad(`${field} must be a URL.`);
  const url = v.trim();
  validateHttpUrl(url, field); // rejects javascript:/data: and malformed URLs
  if (!isOurCloudinaryUrl(url)) {
    throw bad(`${field} must be a file uploaded to our Cloudinary account.`);
  }
  return url;
};

const cleanYear = (v, field) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < MIN_YEAR || n > MAX_YEAR) {
    throw bad(`${field} must be a year between ${MIN_YEAR} and ${MAX_YEAR}.`);
  }
  return n;
};

const asArray = (v, field) => {
  if (!Array.isArray(v)) throw bad(`${field} must be a list.`);
  return v;
};

const normalizeSkills = (v) => {
  const out = [];
  for (const s of asArray(v, 'skills')) {
    const skill = cleanStr(s, MAX_SKILL_LEN, 'skill');
    if (skill) out.push(skill);
  }
  if (out.length > CAP.skills) throw bad(`You can list at most ${CAP.skills} skills.`);
  return out;
};

const normalizeLanguages = (v) => {
  const out = [];
  for (const item of asArray(v, 'languages')) {
    if (!item || typeof item !== 'object') throw bad('Each language must be an object.');
    const name = cleanStr(item.name, MAX_SKILL_LEN, 'language name');
    if (!name) continue; // drop blank rows
    const level = cleanStr(item.level, 20, 'language level');
    if (level && !LANGUAGE_LEVELS.includes(level)) {
      throw bad(`Invalid language level. Allowed: ${LANGUAGE_LEVELS.join(', ')}.`);
    }
    out.push({ name, level: level || null });
  }
  if (out.length > CAP.languages) throw bad(`You can list at most ${CAP.languages} languages.`);
  return out;
};

// Certifications and diplomas share a shape; only the org field name differs.
const makeCredentialNormalizer = (key, orgField) => (v) => {
  const out = [];
  for (const item of asArray(v, key)) {
    if (!item || typeof item !== 'object') throw bad(`Each ${key} entry must be an object.`);
    const title = cleanStr(item.title, MAX_TEXT_LEN, `${key} title`);
    const org = cleanStr(item[orgField], MAX_TEXT_LEN, `${key} ${orgField}`);
    const fileUrl = cleanFileUrl(item.fileUrl, `${key} file`);
    const year = cleanYear(item.year, `${key} year`);
    // Drop fully-empty rows; otherwise require at least a title.
    if (!title && !org && !fileUrl && year === null) continue;
    if (!title) throw bad(`Each ${key} entry needs a title.`);
    out.push({ title, [orgField]: org || null, year, fileUrl });
  }
  if (out.length > CAP[key]) throw bad(`You can list at most ${CAP[key]} ${key}.`);
  return out;
};

const normalizeCertifications = makeCredentialNormalizer('certifications', 'issuer');
const normalizeDiplomas = makeCredentialNormalizer('diplomas', 'institution');

const normalizeSocialLinks = (v) => {
  if (v === null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) throw bad('socialLinks must be an object.');
  const out = {};
  for (const key of SOCIAL_KEYS) {
    const raw = v[key];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    const url = String(raw).trim();
    validateHttpUrl(url, key); // http(s) only — blocks javascript:/data:
    out[key] = url;
  }
  return out;
};

const NORMALIZERS = {
  skills: normalizeSkills,
  languages: normalizeLanguages,
  certifications: normalizeCertifications,
  diplomas: normalizeDiplomas,
  socialLinks: normalizeSocialLinks,
};

/**
 * Validate & normalize the portfolio fields present in a request body.
 * Returns an object containing ONLY the portfolio keys that were provided
 * (so a partial PATCH doesn't wipe untouched fields). Throws AppError on any
 * malformed value. `null` for a field clears it.
 * @param {object} body - req.body
 * @returns {{skills?:string[], languages?:object[], certifications?:object[], diplomas?:object[], socialLinks?:object}}
 */
export const validatePortfolio = (body = {}) => {
  const result = {};
  for (const key of Object.keys(NORMALIZERS)) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const value = body[key];
    if (value === null) {
      result[key] = null; // explicit clear
      continue;
    }
    result[key] = NORMALIZERS[key](value);
  }
  return result;
};
