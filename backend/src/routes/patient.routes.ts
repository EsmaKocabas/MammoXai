import { Router } from 'express';
import { createPatient, listPatients, getPatient } from '../controllers/patient.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(verifyToken);

router.post('/', createPatient);
router.get('/', listPatients);
router.get('/:id', getPatient);

export default router;
