import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePortfolio } from '../../src/utils/portfolioValidation.js';
import { AppError } from '../../src/middleware/error.js';

// isOurCloudinaryUrl reads CLOUDINARY_CLOUD_NAME; set one for the fileUrl tests.
process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'demo212';
const OUR_FILE = 'https://res.cloudinary.com/demo212/raw/upload/v1/212learn/pdfs/cert.pdf';

describe('validatePortfolio', () => {
  it('returns only the provided keys (partial PATCH is safe)', () => {
    const out = validatePortfolio({ skills: ['React'] });
    assert.deepEqual(Object.keys(out), ['skills']);
    assert.deepEqual(out.skills, ['React']);
  });

  it('trims skills, drops blanks, and rejects overly long ones', () => {
    const out = validatePortfolio({ skills: ['  React  ', '', '   '] });
    assert.deepEqual(out.skills, ['React']);
    assert.throws(() => validatePortfolio({ skills: ['x'.repeat(51)] }), AppError);
  });

  it('enforces the skills cap', () => {
    const many = Array.from({ length: 31 }, (_, i) => `s${i}`);
    assert.throws(() => validatePortfolio({ skills: many }), AppError);
  });

  it('validates language level against the enum', () => {
    const out = validatePortfolio({ languages: [{ name: 'Français', level: 'native' }] });
    assert.deepEqual(out.languages, [{ name: 'Français', level: 'native' }]);
    assert.throws(() => validatePortfolio({ languages: [{ name: 'X', level: 'wizard' }] }), AppError);
  });

  it('accepts a certification with an our-Cloudinary file and rejects a foreign URL', () => {
    const out = validatePortfolio({
      certifications: [{ title: 'AWS', issuer: 'Amazon', year: 2024, fileUrl: OUR_FILE }],
    });
    assert.equal(out.certifications[0].title, 'AWS');
    assert.equal(out.certifications[0].fileUrl, OUR_FILE);
    assert.throws(
      () => validatePortfolio({ certifications: [{ title: 'X', fileUrl: 'https://evil.example/x.pdf' }] }),
      AppError
    );
  });

  it('rejects a bad year', () => {
    assert.throws(() => validatePortfolio({ diplomas: [{ title: 'Bac', year: 1200 }] }), AppError);
    assert.throws(() => validatePortfolio({ diplomas: [{ title: 'Bac', year: 3000 }] }), AppError);
  });

  it('requires a title when a credential row has other data', () => {
    assert.throws(() => validatePortfolio({ certifications: [{ issuer: 'Amazon', year: 2024 }] }), AppError);
    // fully-empty rows are simply dropped
    assert.deepEqual(validatePortfolio({ certifications: [{ title: '', issuer: '' }] }).certifications, []);
  });

  it('keeps only known social keys and rejects dangerous URL schemes', () => {
    const out = validatePortfolio({
      socialLinks: { linkedin: 'https://linkedin.com/in/x', evil: 'https://x', github: '' },
    });
    assert.deepEqual(out.socialLinks, { linkedin: 'https://linkedin.com/in/x' });
    assert.throws(
      () => validatePortfolio({ socialLinks: { website: 'javascript:alert(1)' } }),
      AppError
    );
  });

  it('allows explicit null to clear a field', () => {
    assert.deepEqual(validatePortfolio({ skills: null }), { skills: null });
  });

  it('rejects non-array skills / non-object socialLinks', () => {
    assert.throws(() => validatePortfolio({ skills: 'React' }), AppError);
    assert.throws(() => validatePortfolio({ socialLinks: ['x'] }), AppError);
  });
});
