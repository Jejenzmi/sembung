import { Router } from 'express';
import multer from 'multer';
import { Role } from '@prisma/client';
import { created, ok, wrap } from '../lib/http';
import { authenticate, authorize } from '../middleware/auth';
import { simpanBerkas, storageReady } from '../services/storage';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const FOLDER = new Set(['avatar', 'jalur', 'konten', 'sewa', 'bukti']);

router.get('/status', (_req, res) =>
  ok(res, { ready: storageReady(), maxSizeMb: 5, formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'] })
);

/**
 * Unggah gambar. Pendaki hanya boleh mengganti avatar dan mengirim bukti;
 * folder lain (jalur, konten, sewa) khusus administrator.
 */
router.post(
  '/:folder',
  authenticate,
  upload.single('file'),
  wrap(async (req, res) => {
    const folder = req.params.folder;
    if (!FOLDER.has(folder))
      return res.status(400).json({ success: false, message: `Folder ${folder} tidak dikenal` });

    const bebas = folder === 'avatar' || folder === 'bukti';
    if (!bebas && req.user!.role !== Role.ADMIN)
      return res.status(403).json({ success: false, message: 'Hanya administrator' });

    if (!req.file)
      return res.status(400).json({ success: false, message: 'Berkas tidak ditemukan pada kolom "file"' });

    return created(res, await simpanBerkas(folder, req.file), 'Berkas diunggah');
  })
);

export default router;
