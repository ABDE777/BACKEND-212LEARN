import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLearnerProfile,
  validateInstructorProfile,
  toDateOrNull,
} from '../../src/utils/registrationValidation.js';
import { AppError } from '../../src/middleware/error.js';

// Minimal complete fixtures per situation, then mutated to prove enforcement.
const studentOk = {
  situation: 'student',
  school: 'ISFO',
  fieldOfStudy: 'Dev',
  educationLevel: 'bac+2',
  currentLevel: 'beginner',
  academicYearStart: '2025-09-01',
  academicYearEnd: '2026-06-30',
};
const employeeOk = {
  situation: 'employee',
  companyName: 'ABC',
  department: 'IT',
  position: 'Dev',
  sector: 'Tech',
  experienceYears: '1-2',
};
const selfDirectedOk = {
  situation: 'self_directed',
  interests: 'Web',
  learningObjective: 'Learn React',
  currentLevel: 'beginner',
};
const instructorEmployedOk = {
  situation: 'employed',
  expertiseDomain: 'Web Development',
  specialization: 'React & Node.js',
  organization: '212Learn',
  position: 'Lead',
  sector: 'Tech',
  experienceYears: '3-5',
  teachingMode: 'online',
  teachingDomains: 'JS, React',
};
const instructorFreelanceOk = {
  situation: 'freelance',
  expertiseDomain: 'Web Development',
  specialization: 'React & Node.js',
  experienceYears: '6-10',
  teachingMode: 'hybrid',
  teachingDomains: 'JS, React',
};

describe('validateLearnerProfile', () => {
  it('accepts each complete learner situation', () => {
    assert.deepEqual(validateLearnerProfile(studentOk), { isSelfDirected: false });
    assert.deepEqual(validateLearnerProfile(employeeOk), { isSelfDirected: false });
    assert.deepEqual(validateLearnerProfile(selfDirectedOk), { isSelfDirected: true });
    assert.deepEqual(
      validateLearnerProfile({ ...studentOk, ...employeeOk, situation: 'student_employee' }),
      { isSelfDirected: false }
    );
  });

  it('rejects an unknown situation', () => {
    assert.throws(() => validateLearnerProfile({ situation: 'nope' }), AppError);
    assert.throws(() => validateLearnerProfile({}), AppError);
    assert.throws(() => validateLearnerProfile(null), AppError);
  });

  it('requires the student fields for situation student', () => {
    assert.throws(() => validateLearnerProfile({ ...studentOk, school: '' }), (e) => {
      assert.ok(e instanceof AppError);
      assert.match(e.message, /school/);
      return true;
    });
  });

  it('requires the employee fields for situation employee', () => {
    assert.throws(() => validateLearnerProfile({ ...employeeOk, companyName: undefined }), AppError);
  });

  it('requires both field sets for student_employee', () => {
    // missing the employee half
    assert.throws(() => validateLearnerProfile({ ...studentOk, situation: 'student_employee' }), AppError);
  });

  it('requires interests/objective for self_directed', () => {
    assert.throws(() => validateLearnerProfile({ ...selfDirectedOk, learningObjective: '' }), AppError);
  });

  it('rejects invalid value enums', () => {
    assert.throws(() => validateLearnerProfile({ ...studentOk, educationLevel: 'phd' }), AppError);
    assert.throws(() => validateLearnerProfile({ ...studentOk, currentLevel: 'expert' }), AppError);
    assert.throws(() => validateLearnerProfile({ ...employeeOk, experienceYears: '100' }), AppError);
  });
});

describe('validateInstructorProfile', () => {
  it('accepts complete employed and freelance instructors', () => {
    assert.doesNotThrow(() => validateInstructorProfile(instructorEmployedOk));
    assert.doesNotThrow(() => validateInstructorProfile(instructorFreelanceOk));
    assert.doesNotThrow(() => validateInstructorProfile({ ...instructorFreelanceOk, situation: 'unemployed' }));
  });

  it('rejects an unknown situation', () => {
    assert.throws(() => validateInstructorProfile({ ...instructorFreelanceOk, situation: 'nope' }), AppError);
  });

  it('requires the common expertise fields', () => {
    assert.throws(() => validateInstructorProfile({ ...instructorFreelanceOk, expertiseDomain: '' }), AppError);
    assert.throws(() => validateInstructorProfile({ ...instructorFreelanceOk, teachingDomains: undefined }), AppError);
  });

  it('requires organization only for employed instructors', () => {
    // employed without organization -> reject
    assert.throws(() => validateInstructorProfile({ ...instructorEmployedOk, organization: '' }), AppError);
    // freelance without organization -> ok
    assert.doesNotThrow(() => validateInstructorProfile(instructorFreelanceOk));
  });

  it('rejects invalid teachingMode / experience enums', () => {
    assert.throws(() => validateInstructorProfile({ ...instructorFreelanceOk, teachingMode: 'telepathy' }), AppError);
    assert.throws(() => validateInstructorProfile({ ...instructorFreelanceOk, experienceYears: '7' }), AppError);
  });
});

describe('toDateOrNull', () => {
  it('coerces a date-only string (from <input type="date">) to a Date', () => {
    const d = toDateOrNull('2026-07-31', 'academicYearStart');
    assert.ok(d instanceof Date);
    assert.equal(d.toISOString(), '2026-07-31T00:00:00.000Z');
  });

  it('accepts a full ISO-8601 datetime', () => {
    const d = toDateOrNull('2026-07-31T12:34:56.000Z', 'academicYearStart');
    assert.equal(d.toISOString(), '2026-07-31T12:34:56.000Z');
  });

  it('returns null for blank/absent values', () => {
    assert.equal(toDateOrNull(undefined, 'f'), null);
    assert.equal(toDateOrNull(null, 'f'), null);
    assert.equal(toDateOrNull('', 'f'), null);
    assert.equal(toDateOrNull('   ', 'f'), null);
  });

  it('throws a clean AppError on an unparseable date', () => {
    assert.throws(() => toDateOrNull('not-a-date', 'academicYearStart'), (e) => {
      assert.ok(e instanceof AppError);
      assert.equal(e.statusCode, 400);
      assert.match(e.message, /academicYearStart/);
      return true;
    });
  });
});
