import multer from 'multer';
import { config } from '../config.js';

export const mediaUpload = multer({
  dest: config.mediaDir,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (_, file, done) => {
    const valid = file.fieldname === 'video' ? file.mimetype.startsWith('video/') : file.fieldname === 'cover' ? file.mimetype.startsWith('image/') : false;
    done(null, valid);
  },
});

export const chunkUpload = multer({ dest: config.chunkDir, limits: { fileSize: 8 * 1024 * 1024 } });

