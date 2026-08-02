import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUUID,
  validateRequired,
  validateEmail,
  validateEnum,
  validateNumberRange,
} from '../../src/utils/validation.js';
import { AppError } from '../../src/middleware/error.js';

describe('validation utils', () => {
  it('accepts valid UUIDs', () => {
    assert.equal(
      validateUUID('3e3f3526-4fdc-4faf-b74a-762472859951', 'lessonId'),
      true
    );
  });

  it('rejects invalid UUIDs with AppError', () => {
    assert.throws(() => validateUUID('not-a-uuid', 'id'), (err) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'VALIDATION_ERROR');
      return true;
    });
  });

  it('requires missing fields', () => {
    assert.throws(() => validateRequired({ title: 'x' }, ['title', 'prompt']), (err) => {
      assert.match(err.message, /prompt/);
      return true;
    });
  });

  it('accepts complete required fields', () => {
    assert.doesNotThrow(() => validateRequired({ title: 't', prompt: 'p' }, ['title', 'prompt']));
  });

  it('validates email format', () => {
    assert.doesNotThrow(() => validateEmail('student1@212learn.com'));
    assert.throws(() => validateEmail('bad-email'), AppError);
  });

  it('validates enums', () => {
    assert.doesNotThrow(() => validateEnum('approved', ['draft', 'approved'], 'status'));
    assert.throws(() => validateEnum('nope', ['draft', 'approved'], 'status'), AppError);
  });

  it('validates number ranges', () => {
    assert.doesNotThrow(() => validateNumberRange(5, { min: 1, max: 20 }, 'questionCount'));
    assert.throws(() => validateNumberRange(0, { min: 1, max: 20 }, 'questionCount'), AppError);
    assert.throws(() => validateNumberRange(21, { min: 1, max: 20 }, 'questionCount'), AppError);
  });
});
