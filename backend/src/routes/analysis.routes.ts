import { Router } from 'express';
import {
  createAnalysis,
  listAnalyses,
  getAnalysis,
  reviewAnalysis,
  deleteAnalysis,
  getAnalysisReport,
} from '../controllers/analysis.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { uploadMammogram } from '../middlewares/upload.middleware.js';

const router = Router();

router.use(verifyToken);

// Token doğrulandıktan sonra dosya kabul edilir (yetkisiz istekler diske yazamaz)
router.post('/', uploadMammogram, createAnalysis);
router.get('/', listAnalyses);
router.get('/:id', getAnalysis);
router.get('/:id/report', getAnalysisReport);
router.put('/:id/review', reviewAnalysis);
router.delete('/:id', deleteAnalysis);

export default router;
