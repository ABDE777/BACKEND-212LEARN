import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// ─── Configure Cloudinary SDK ──────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Cloudinary multer storage ────────────────────────────────────────────────
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // Choose folder and resource_type based on mimetype
    let folder       = '212learn/misc';
    let resourceType = 'auto';

    if (file.mimetype.startsWith('video/')) {
      folder       = '212learn/videos';
      resourceType = 'video';
    } else if (file.mimetype === 'application/pdf') {
      folder       = '212learn/pdfs';
      resourceType = 'raw';
    } else if (
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed'
    ) {
      folder       = '212learn/zips';
      resourceType = 'raw';
    } else if (
      file.mimetype === 'application/msword' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      folder       = '212learn/documents';
      resourceType = 'raw';
    } else if (file.mimetype.startsWith('image/')) {
      folder       = '212learn/images';
      resourceType = 'image';
    }

    const params = {
      folder,
      resource_type: resourceType,
      use_filename:  true,
      unique_filename: true,
    };

    // For raw files (PDFs, ZIPs, documents), add options to prevent processing
    if (resourceType === 'raw') {
      params.format = null;
      params.pages = false;
      params.transformation = [];
      params.async = false;
      params.eager = [];
    }

    return params;
  },
});

// ─── Memory storage for PDFs and documents (to prevent Cloudinary processing) ───
const memoryStorage = multer.memoryStorage();

// ─── File filter ──────────────────────────────────────────────────────────────
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

// ─── Multer upload instance ───────────────────────────────────────────────────
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

// ─── Multer upload instance for PDFs/documents (uses memory storage) ───────────
export const uploadRaw = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

export { cloudinary };
