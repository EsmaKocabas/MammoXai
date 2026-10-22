import { Router } from 'express';
import {
  createPatient,
  listPatients,
  getPatient,
  updatePatient,
  deletePatient,
} from '../controllers/patient.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(verifyToken);

router.post('/', createPatient);
router.get('/', listPatients);
router.get('/:id', getPatient);
router.put('/:id', updatePatient);
router.delete('/:id', deletePatient);

export default router;
