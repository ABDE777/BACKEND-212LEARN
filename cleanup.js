import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filesToDelete = [
  path.join(__dirname, 'tsconfig.json'),
  path.join(__dirname, 'schema.prisma'),
  path.join(__dirname, 'src/index.ts'),
  path.join(__dirname, 'src/config/prisma.ts'),
  path.join(__dirname, 'src/middleware/error.ts')
];

console.log('🧹 Starting cleanup of deprecated files...');

filesToDelete.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`✅ Deleted: ${filePath}`);
    } catch (err) {
      console.error(`❌ Failed to delete ${filePath}:`, err.message);
    }
  } else {
    console.log(`ℹ️ Already deleted or does not exist: ${filePath}`);
  }
});

console.log('🎉 Cleanup complete!');
