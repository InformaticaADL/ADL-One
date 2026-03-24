import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../uploads/')); // Path to uploads directory
    },
    filename: function (req, file, cb) {
        // Create unique filenames with original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ storage: storage });

// Single file upload endpoint
// The 'file' argument matches the fieldname in the FormData sent by the frontend
router.post('/', upload.single('archivo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Return the path where the file can be accessed by the frontend
        res.json({
            success: true,
            message: 'File uploaded successfully',
            filePath: `/uploads/${req.file.filename}`,  // Important: path relative to server root
            fileName: req.file.originalname
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ success: false, message: 'Internal server error during upload' });
    }
});

export default router;
