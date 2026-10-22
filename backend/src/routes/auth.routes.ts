import { Router } from 'express';
import { register, login, getMe, updateProfile } from '../controllers/auth.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = Router();

// Açık rotalar
router.post('/register', register);
router.post('/login', login);

// Token korumalı rotalar (Giriş yapmış doktorun profili)
router.get('/me', verifyToken, getMe);
router.put('/profile', verifyToken, updateProfile);

export default router;