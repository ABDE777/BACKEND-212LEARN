import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { randomBytes } from 'crypto';

// ─── Configure Cloudinary SDK ──────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/** Cloudinary Free-plan maxima. */
export const CLOUDINARY_MAX_BYTES = {
  image: 10 * 1024 * 1024,  // 10 MB
  raw:   10 * 1024 * 1024,  // 10 MB (pdf / zip / doc)
  video: 100 * 1024 * 1024, // 100 MB
};

/**
 * Vercel serverless request body hard limit is 4.5 MB.
 * Multipart through the API must stay under this — larger files need
 * direct browser → Cloudinary upload (signed endpoint).
 */
export const VERCEL_SAFE_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB safety margin

const TYPE_TARGETS = {
  video:    { folder: '212learn/videos',    resourceType: 'video', sizeClass: 'video', mimeHint: 'video/mp4' },
  pdf:      { folder: '212learn/pdfs',      resourceType: 'raw',   sizeClass: 'raw',   mimeHint: 'application/pdf' },
  zip:      { folder: '212learn/zips',      resourceType: 'raw',   sizeClass: 'raw',   mimeHint: 'application/zip' },
  document: { folder: '212learn/documents', resourceType: 'raw',   sizeClass: 'raw',   mimeHint: 'application/msword' },
  image:    { folder: '212learn/images',    resourceType: 'image', sizeClass: 'image', mimeHint: 'image/jpeg' },
};

/** Above this, Cloudinary requires chunked upload_large. */
const CHUNK_THRESHOLD = 100 * 1024 * 1024;
const CHUNK_SIZE = 20 * 1024 * 1024;

const MIME_TO_EXT = {
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

function sanitizeBaseName(name) {
  return String(name || 'file')
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 120) || 'file';
}

export function resolveUploadTarget(mimetype) {
  if (mimetype.startsWith('video/')) {
    return { folder: '212learn/videos', resourceType: 'video', sizeClass: 'video' };
  }
  if (mimetype === 'application/pdf') {
    return { folder: '212learn/pdfs', resourceType: 'raw', sizeClass: 'raw' };
  }
  if (mimetype === 'application/zip' || mimetype === 'application/x-zip-compressed') {
    return { folder: '212learn/zips', resourceType: 'raw', sizeClass: 'raw' };
  }
  if (
    mimetype === 'application/msword' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return { folder: '212learn/documents', resourceType: 'raw', sizeClass: 'raw' };
  }
  if (mimetype.startsWith('image/')) {
    return { folder: '212learn/images', resourceType: 'image', sizeClass: 'image' };
  }
  return { folder: '212learn/misc', resourceType: 'auto', sizeClass: 'raw' };
}

export function ensureOriginalFilename(originalname, mimetype) {
  const parsed = path.parse(originalname || 'file');
  const base = sanitizeBaseName(parsed.name);
  let ext = (parsed.ext || '').toLowerCase();
  if (!ext) ext = MIME_TO_EXT[mimetype] || '';
  if (!ext) ext = '.bin';
  return `${base}${ext}`;
}

export function maxBytesForMimetype(mimetype) {
  const { sizeClass } = resolveUploadTarget(mimetype);
  return CLOUDINARY_MAX_BYTES[sizeClass] || CLOUDINARY_MAX_BYTES.raw;
}

export function resolveTargetByType(type) {
  const target = TYPE_TARGETS[type];
  if (!target) return null;
  return target;
}

export function isOurCloudinaryUrl(url) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud || !url) return false;
  try {
    const u = new URL(url);
    return (
      u.hostname === 'res.cloudinary.com' &&
      u.pathname.startsWith(`/${cloud}/`)
    );
  } catch {
    return false;
  }
}

/**
 * Build a signed payload so the browser can upload directly to Cloudinary
 * (bypasses Vercel's 4.5 MB function body limit).
 */
export function createSignedUpload({ type, filename, mimetype }) {
  const byType = type ? resolveTargetByType(type) : null;
  const byMime = mimetype ? resolveUploadTarget(mimetype) : null;

  const folder = byType?.folder || byMime?.folder || '212learn/misc';
  const resourceType = byType?.resourceType || byMime?.resourceType || 'auto';
  const sizeClass = byType?.sizeClass || byMime?.sizeClass || 'raw';
  const mime = mimetype || byType?.mimeHint || 'application/octet-stream';

  const safeName = ensureOriginalFilename(filename || 'file', mime);
  const parsed = path.parse(safeName);
  const uniqueSuffix = Date.now().toString(36);
  const publicId =
    resourceType === 'raw'
      ? `${parsed.name}_${uniqueSuffix}${parsed.ext}`
      : `${parsed.name}_${uniqueSuffix}`;

  const timestamp = Math.round(Date.now() / 1000);
  // Only sign params that will be sent with the upload (except file/api_key/resource_type)
  const paramsToSign = {
    timestamp,
    folder,
    public_id: publicId,
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET
  );

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  return {
    cloudName,
    apiKey: process.env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    folder,
    public_id: publicId,
    resource_type: resourceType,
    maxBytes: CLOUDINARY_MAX_BYTES[sizeClass],
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
  };
}

function buildUploadOptions(file) {
  const { folder, resourceType } = resolveUploadTarget(file.mimetype);
  const filename = ensureOriginalFilename(file.originalname, file.mimetype);
  const parsed = path.parse(filename);
  const uniqueSuffix = Date.now().toString(36);
  const publicId =
    resourceType === 'raw'
      ? `${parsed.name}_${uniqueSuffix}${parsed.ext}`
      : `${parsed.name}_${uniqueSuffix}`;

  return {
    folder,
    resource_type: resourceType,
    public_id: publicId,
    use_filename: false,
    unique_filename: false,
    overwrite: false,
    filename_override: filename,
  };
}

async function unlinkQuietly(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore missing temp files
  }
}

/**
 * Upload a multer file (disk path preferred) to Cloudinary.
 * Uses chunked upload_large for files over 100 MB (required by Cloudinary).
 * Always deletes the temp disk file when done.
 */
export async function uploadFileToCloudinary(file) {
  const options = buildUploadOptions(file);
  const size = file.size || 0;

  try {
    if (file.path) {
      if (size > CHUNK_THRESHOLD) {
        return await cloudinary.uploader.upload_large(file.path, {
          ...options,
          chunk_size: CHUNK_SIZE,
        });
      }
      return await cloudinary.uploader.upload(file.path, options);
    }

    // Memory-storage fallback (small files only)
    if (size > CHUNK_THRESHOLD) {
      throw new Error('Large files require disk storage for chunked Cloudinary upload.');
    }

    return await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
      stream.end(file.buffer);
    });
  } finally {
    await unlinkQuietly(file.path);
  }
}

/** @deprecated use uploadFileToCloudinary */
export function uploadBufferToCloudinary(file) {
  return uploadFileToCloudinary(file);
}

export function publicIdFromCloudinaryUrl(url, { keepExtension = false } = {}) {
  const urlParts = url.split('/');
  const uploadIdx = urlParts.indexOf('upload');
  if (uploadIdx === -1) return null;

  let start = uploadIdx + 1;
  while (start < urlParts.length && !/^v\d+$/.test(urlParts[start])) {
    start += 1;
  }
  if (start < urlParts.length && /^v\d+$/.test(urlParts[start])) {
    start += 1;
  }

  const publicIdWithExt = decodeURIComponent(urlParts.slice(start).join('/'));
  if (keepExtension) return publicIdWithExt;
  return publicIdWithExt.replace(/\.[^.]+$/, '');
}

// ─── Multer: disk storage (supports large videos without loading into RAM) ───
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || MIME_TO_EXT[file.mimetype] || '';
    cb(null, `212learn-${Date.now()}-${randomBytes(6).toString('hex')}${ext}`);
  },
});

// Direct-to-Cloudinary storage (avatars / receipts — typically small images)
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file) => buildUploadOptions(file),
});

const fileFilter = (_req, file, cb) => {
  const allowed = [
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf',
    'application/zip', 'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

/** After multer, enforce Cloudinary + Vercel-safe sizes; clean temp on reject. */
export function enforceCloudinarySizeLimit(req, res, next) {
  if (!req.file) return next();

  if (req.file.size > VERCEL_SAFE_UPLOAD_BYTES) {
    unlinkQuietly(req.file.path);
    return next(
      new Error(
        `File exceeds Vercel’s 4.5 MB API limit (${Math.round(req.file.size / 1024 / 1024)} MB). ` +
          'Upload directly to Cloudinary: POST /api/v1/uploads/cloudinary-sign then POST the secure_url to /resources.'
      )
    );
  }

  const max = maxBytesForMimetype(req.file.mimetype);
  if (req.file.size > max) {
    unlinkQuietly(req.file.path);
    const mb = Math.round(max / (1024 * 1024));
    return next(new Error(`File too large. Max for this type is ${mb} MB (Cloudinary Free limit).`));
  }
  return next();
}

export const upload = multer({
  storage,
  fileFilter,
  // Avatars/receipts stay small; still cap under Vercel body limit when hosted there
  limits: { fileSize: VERCEL_SAFE_UPLOAD_BYTES },
});

/** Lesson resources via API proxy — only safe under Vercel 4.5 MB. Prefer signed direct upload. */
export const uploadRaw = multer({
  storage: diskStorage,
  fileFilter,
  limits: { fileSize: VERCEL_SAFE_UPLOAD_BYTES },
});

export { cloudinary };
