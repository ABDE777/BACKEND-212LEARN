import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureOriginalFilename,
  resolveUploadTarget,
  resolveTargetByType,
  isOurCloudinaryUrl,
  maxBytesForMimetype,
  publicIdFromCloudinaryUrl,
  CLOUDINARY_MAX_BYTES,
  VERCEL_SAFE_UPLOAD_BYTES,
} from '../../src/config/cloudinary.js';

describe('cloudinary helpers', () => {
  const prevCloud = process.env.CLOUDINARY_CLOUD_NAME;

  beforeEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
  });

  afterEach(() => {
    if (prevCloud === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = prevCloud;
  });

  it('maps mime types to folders and resource types', () => {
    assert.deepEqual(resolveUploadTarget('application/pdf'), {
      folder: '212learn/pdfs',
      resourceType: 'raw',
      sizeClass: 'raw',
    });
    assert.equal(resolveUploadTarget('video/mp4').resourceType, 'video');
    assert.equal(resolveUploadTarget('image/png').folder, '212learn/images');
  });

  it('resolves targets by resource type string', () => {
    assert.equal(resolveTargetByType('pdf').folder, '212learn/pdfs');
    assert.equal(resolveTargetByType('zip').resourceType, 'raw');
    assert.equal(resolveTargetByType('nope'), null);
  });

  it('ensures filenames keep a real extension', () => {
    assert.equal(ensureOriginalFilename('My Notes.pdf', 'application/pdf'), 'My_Notes.pdf');
    assert.equal(ensureOriginalFilename('archive', 'application/zip'), 'archive.zip');
  });

  it('exposes Free-plan and Vercel-safe size caps', () => {
    assert.equal(maxBytesForMimetype('application/pdf'), CLOUDINARY_MAX_BYTES.raw);
    assert.equal(maxBytesForMimetype('video/mp4'), CLOUDINARY_MAX_BYTES.video);
    assert.ok(VERCEL_SAFE_UPLOAD_BYTES < CLOUDINARY_MAX_BYTES.raw);
  });

  it('accepts only URLs from our Cloudinary cloud', () => {
    assert.equal(
      isOurCloudinaryUrl('https://res.cloudinary.com/demo-cloud/raw/upload/v1/212learn/pdfs/a.pdf'),
      true
    );
    assert.equal(
      isOurCloudinaryUrl('https://res.cloudinary.com/other/raw/upload/v1/a.pdf'),
      false
    );
    assert.equal(isOurCloudinaryUrl('https://example.com/file.pdf'), false);
  });

  it('extracts public_id from Cloudinary URLs', () => {
    const raw = publicIdFromCloudinaryUrl(
      'https://res.cloudinary.com/demo/raw/upload/v123/212learn/pdfs/notes_abc.pdf',
      { keepExtension: true }
    );
    assert.equal(raw, '212learn/pdfs/notes_abc.pdf');

    const image = publicIdFromCloudinaryUrl(
      'https://res.cloudinary.com/demo/image/upload/v123/212learn/images/photo_abc.jpg',
      { keepExtension: false }
    );
    assert.equal(image, '212learn/images/photo_abc');
  });
});
