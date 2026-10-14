import biologiaMolecularService from '../services/biologia-molecular.service.js';
import logger from '../utils/logger.js';

class BiologiaMolecularController {

    /**
     * GET /api/biologia-molecular/muestras
     * Parámetros de query: fecha_desde, fecha_hasta, id_lugaranalisis
     */
    async getConsultaMuestras(req, res) {
        try {
            const { 
                fecha_desde = '2026-01-01', 
                fecha_hasta = '2026-12-31',
                id_lugaranalisis = 1 
            } = req.query;

            const data = await biologiaMolecularService.getConsultaMuestras({
                fecha_desde,
                fecha_hasta,
                id_lugaranalisis: Number(id_lugaranalisis) || 1
            });

            return res.status(200).json({
                success: true,
                count: data.length,
                filters: {
                    fecha_desde,
                    fecha_hasta,
                    id_lugaranalisis: Number(id_lugaranalisis) || 1
                },
                data
            });
        } catch (error) {
            logger.error('Error en BiologiaMolecularController.getConsultaMuestras:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al consultar muestras de Biología Molecular en LaboratorioADL',
                error: error.message
            });
        }
    }
}

export const biologiaMolecularController = new BiologiaMolecularController();
export default biologiaMolecularController;
