import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';
import path from 'path';

// ─── Configure Cloudinary SDK ──────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

/** Resolve folder + Cloudinary resource_type from mimetype */
export function resolveUploadTarget(mimetype) {
  if (mimetype.startsWith('video/')) {
    return { folder: '212learn/videos', resourceType: 'video' };
  }
  if (mimetype === 'application/pdf') {
    return { folder: '212learn/pdfs', resourceType: 'raw' };
  }
  if (mimetype === 'application/zip' || mimetype === 'application/x-zip-compressed') {
    return { folder: '212learn/zips', resourceType: 'raw' };
  }
  if (
    mimetype === 'application/msword' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return { folder: '212learn/documents', resourceType: 'raw' };
  }
  if (mimetype.startsWith('image/')) {
    return { folder: '212learn/images', resourceType: 'image' };
  }
  return { folder: '212learn/misc', resourceType: 'auto' };
}

/** Ensure originalname has a real extension (Cloudinary needs it for raw URLs). */
export function ensureOriginalFilename(originalname, mimetype) {
  const parsed = path.parse(originalname || 'file');
  const base = sanitizeBaseName(parsed.name);
  let ext = (parsed.ext || '').toLowerCase();
  if (!ext) ext = MIME_TO_EXT[mimetype] || '';
  if (!ext) ext = '.bin';
  return `${base}${ext}`;
}

/**
 * Upload a multer memory-storage file buffer to Cloudinary,
 * preserving the original filename + extension in the returned URL.
 *
 * Without filename_override, upload_stream has no name and Cloudinary stores
 * assets as extensionless "file_xxxxx" — browsers then download the wrong type.
 */
export function uploadBufferToCloudinary(file) {
  const { folder, resourceType } = resolveUploadTarget(file.mimetype);
  const filename = ensureOriginalFilename(file.originalname, file.mimetype);

  // For raw, public_id must include the extension. Append a short unique suffix
  // ourselves so uniqueness never becomes "name.pdf_abc" (broken extension).
  const parsed = path.parse(filename);
  const uniqueSuffix = Date.now().toString(36);
  const publicId =
    resourceType === 'raw'
      ? `${parsed.name}_${uniqueSuffix}${parsed.ext}`
      : `${parsed.name}_${uniqueSuffix}`;

  const options = {
    folder,
    resource_type: resourceType,
    public_id: publicId,
    use_filename: false,
    unique_filename: false,
    overwrite: false,
    filename_override: filename,
  };

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    stream.end(file.buffer);
  });
}

/** Extract Cloudinary public_id from a secure_url (raw keeps extension). */
export function publicIdFromCloudinaryUrl(url, { keepExtension = false } = {}) {
  const urlParts = url.split('/');
  const uploadIdx = urlParts.indexOf('upload');
  if (uploadIdx === -1) return null;

  // After "upload" comes optional transformations, then "v123...", then public_id path
  let start = uploadIdx + 1;
  // skip transformation segments until version token v123456
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

// ─── Cloudinary multer storage (disk/stream via CloudinaryStorage) ────────────
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file) => {
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
      filename_override: filename,
    };
  },
});

const memoryStorage = multer.memoryStorage();

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

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 },
});

export const uploadRaw = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 },
});

export { cloudinary };
