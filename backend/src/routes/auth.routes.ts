import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Açık rotalar
router.post('/register', register);
router.post('/login', login);

// Token korumalı rota (Giriş yapmış doktorun profili)
router.get('/me', verifyToken, getMe);

export default router;