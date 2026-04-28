import express from 'express';
import multer from 'multer';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import * as kpiAnalystController from '../controllers/kpi-analyst.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get(
    '/dashboard-kpis',
    authenticate,
    verifyPermission('MA_COORDINACION_ACCESO'),
    kpiAnalystController.getDashboardKpis,
);

router.get(
    '/dashboard-kpis/status',
    authenticate,
    verifyPermission('MA_COORDINACION_ACCESO'),
    kpiAnalystController.getDashboardKpiStatus,
);

router.post(
    '/dashboard-kpis/execute',
    authenticate,
    verifyPermission('MA_COORDINACION_ACCESO'),
    kpiAnalystController.executeDashboardKpis,
);

router.post(
    '/dashboard-kpis/events',
    authenticate,
    verifyPermission('MA_COORDINACION_ACCESO'),
    kpiAnalystController.registerDashboardKpiEvent,
);

router.post(
    '/dashboard-kpis/excel',
    authenticate,
    verifyPermission('MA_COORDINACION_ACCESO'),
    upload.single('archivo'),
    kpiAnalystController.analyzeExcelDashboard,
);

export default router;
