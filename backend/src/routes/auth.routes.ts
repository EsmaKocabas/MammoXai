import { verifyToken } from '../middlewares/auth.middleware.js';
import {
    register,
    login,
    getMe,
    updateProfile,
    forgotPassword,
    resetPassword,
} from '../controllers/auth.controller.js';
import { Router } from 'express';

const router = Router();

// Açık rotalar
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Token korumalı rotalar (Giriş yapmış doktorun profili)
router.get('/me', verifyToken, getMe);
router.put('/profile', verifyToken, updateProfile);

export default router;