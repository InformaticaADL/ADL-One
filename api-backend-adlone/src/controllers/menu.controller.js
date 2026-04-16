import menuService from '../services/menu.service.js';
import logger from '../utils/logger.js';

class MenuController {
    async getDynamicMenu(req, res) {
        try {
            // User permissions injected by 'authenticate' middleware
            const userPermissions = req.user.permissions || [];
            
            const menu = await menuService.getDynamicMenu(userPermissions);
            
            res.json({
                success: true,
                data: menu
            });
        } catch (error) {
            logger.error('Error in MenuController.getDynamicMenu:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener el menú dinámico'
            });
        }
    }

    async getAllAdminData(req, res) {
        try {
            const data = await menuService.getAllAdminData();
            res.json({ success: true, data });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error retrieving admin menu data' });
        }
    }

    async createModulo(req, res) {
        try {
            const result = await menuService.createModulo(req.body);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updateModulo(req, res) {
        try {
            const result = await menuService.updateModulo(req.params.id, req.body);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async deleteModulo(req, res) {
        try {
            const result = await menuService.deleteModulo(req.params.id);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async createLink(req, res) {
        try {
            const result = await menuService.createLink(req.body);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updateLink(req, res) {
        try {
            const result = await menuService.updateLink(req.params.id, req.body);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async deleteLink(req, res) {
        try {
            const result = await menuService.deleteLink(req.params.id);
            res.json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

export default new MenuController();
