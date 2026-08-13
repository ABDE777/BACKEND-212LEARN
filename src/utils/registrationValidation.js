import { AppError } from '../middleware/error.js';
import { validateEnum } from './validation.js';

// ─── Canonical registration vocabularies (enforced server-side) ───────────────
// The frontend registration form (5 phases) drives these; keeping the allowed
// values here is the single source of truth so the form's "Required" markers and
// dropdowns are actually enforced by the API, not just the UI.

export const LEARNER_SITUATIONS = ['student', 'employee', 'student_employee', 'self_directed'];
export const INSTRUCTOR_SITUATIONS = ['employed', 'freelance', 'unemployed'];

export const EDUCATION_LEVELS = ['college', 'lycee', 'bac', 'bac+1', 'bac+2', 'bac+3', 'bac+4', 'bac+5', 'autre'];
export const CURRENT_LEVELS = ['beginner', 'intermediate', 'advanced'];
export const TEACHING_MODES = ['online', 'onsite', 'hybrid'];
export const EXPERIENCE_RANGES = ['<1', '1-2', '3-5', '6-10', '>10'];

// A field counts as "provided" when it isn't undefined/null/blank.
const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim());

const requireFields = (obj, fields) => {
  const missing = fields.filter((f) => isBlank(obj[f]));
  if (missing.length > 0) {
    throw new AppError(`Missing required profile fields: ${missing.join(', ')}.`, 400, 'VALIDATION_ERROR');
  }
};

// Validate an enum value only when it was provided (required-ness is handled
// separately by requireFields so error messages stay specific).
const validateOptionalEnum = (value, allowed, fieldName) => {
  if (!isBlank(value)) validateEnum(value, allowed, fieldName);
};

/**
 * Coerce a form date into a value Prisma's DateTime column accepts.
 * An <input type="date"> submits a date-only string ("2026-07-31"), but Prisma
 * rejects that for a DateTime field (it demands a full ISO-8601 value), so the
 * raw string would surface as an opaque PrismaClientValidationError. Convert it
 * to a Date here; blank → null; an unparseable value → a clean 400.
 * @param {*} value
 * @param {string} fieldName
 * @returns {Date|null}
 */
export const toDateOrNull = (value, fieldName) => {
  if (isBlank(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid date for ${fieldName}.`, 400, 'VALIDATION_ERROR');
  }
  return date;
};

/**
 * Validate a learner (Apprenant) profile against its situation.
 * Enforces the situation enum, the per-situation required fields, and the value
 * enums. Returns the normalized isSelfDirected flag for the caller to persist.
 * @param {object} profile - req.body.studentProfile
 * @returns {{ isSelfDirected: boolean }}
 */
export const validateLearnerProfile = (profile) => {
  if (!profile || typeof profile !== 'object') {
    throw new AppError('Profile information is required.', 400, 'VALIDATION_ERROR');
  }

  const situation = profile.situation;
  validateEnum(situation, LEARNER_SITUATIONS, 'situation');

  const studentFields = ['school', 'fieldOfStudy', 'educationLevel', 'currentLevel', 'academicYearStart', 'academicYearEnd'];
  const employeeFields = ['companyName', 'department', 'position', 'sector', 'experienceYears'];

  if (situation === 'student' || situation === 'student_employee') {
    requireFields(profile, studentFields);
  }
  if (situation === 'employee' || situation === 'student_employee') {
    requireFields(profile, employeeFields);
  }
  if (situation === 'self_directed') {
    requireFields(profile, ['interests', 'learningObjective', 'currentLevel']);
  }

  // Value enums (only when the value is present)
  validateOptionalEnum(profile.educationLevel, EDUCATION_LEVELS, 'educationLevel');
  validateOptionalEnum(profile.currentLevel, CURRENT_LEVELS, 'currentLevel');
  validateOptionalEnum(profile.experienceYears, EXPERIENCE_RANGES, 'experienceYears');

  return { isSelfDirected: situation === 'self_directed' };
};

/**
 * Validate an instructor (Instructeur / Formateur) profile against its situation.
 * @param {object} profile - req.body.instructorProfile
 */
export const validateInstructorProfile = (profile) => {
  if (!profile || typeof profile !== 'object') {
    throw new AppError('Instructor profile information is required.', 400, 'VALIDATION_ERROR');
  }

  const situation = profile.situation;
  validateEnum(situation, INSTRUCTOR_SITUATIONS, 'situation');

  // Common to every instructor situation.
  requireFields(profile, ['expertiseDomain', 'specialization', 'experienceYears', 'teachingMode', 'teachingDomains']);

  // Employed instructors also declare where they work.
  if (situation === 'employed') {
    requireFields(profile, ['organization', 'position', 'sector']);
  }

  validateOptionalEnum(profile.teachingMode, TEACHING_MODES, 'teachingMode');
  validateOptionalEnum(profile.experienceYears, EXPERIENCE_RANGES, 'experienceYears');
};
