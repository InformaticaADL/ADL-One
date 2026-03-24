import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import userController from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

dotenv.config();

const router = express.Router();

// Ensure upload directory exists
// Ensure upload directory exists
let uploadDir = process.env.PROFILE_PICS_PATH || 'uploads/profile_pics';
uploadDir = path.resolve(uploadDir);
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, webp)'));
    }
});

// Routes
router.get('/profile', authenticate, userController.getProfile);
router.post('/profile-picture', authenticate, upload.single('photo'), userController.uploadProfilePicture);
router.post('/avatar', authenticate, userController.setPredefinedAvatar);
router.post('/change-password', authenticate, userController.changePassword);

export default router;
