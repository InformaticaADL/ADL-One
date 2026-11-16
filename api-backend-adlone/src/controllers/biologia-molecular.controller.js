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
                id_lugaranalisis = 1,
                solo_menor_ct = 'false',
                limite = 50000
            } = req.query;

            const isSoloMenorCT = String(solo_menor_ct).toLowerCase() === 'true';

            const data = await biologiaMolecularService.getConsultaMuestras({
                fecha_desde,
                fecha_hasta,
                id_lugaranalisis: Number(id_lugaranalisis) || 1,
                solo_menor_ct: isSoloMenorCT,
                limite: Number(limite) || 50000,
                fresco: req.query.fresco === '1'
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

    /**
     * GET /api/biologia-molecular/export-excel
     * Exportación de archivo Excel (.xlsx) nativo vía streaming HTTP
     */
    async exportExcel(req, res) {
        try {
            const { 
                fecha_desde = '2026-01-01', 
                fecha_hasta = '2026-12-31',
                id_lugaranalisis = 1,
                solo_menor_ct = 'false',
                categoria = 'ALL',
                centro = 'ALL',
                matriz = 'ALL',
                tecnica = 'ALL'
            } = req.query;

            const isSoloMenorCT = String(solo_menor_ct).toLowerCase() === 'true';

            const suffixCT = isSoloMenorCT ? '_menor_ct_max28' : '';
            const suffixCat = categoria && categoria !== 'ALL' ? `_${categoria.toLowerCase()}` : '';
            const suffixCentro = centro && centro !== 'ALL' ? `_${String(centro).replace(/\s+/g, '_')}` : '';
            const suffixMatriz = matriz && matriz !== 'ALL' ? `_${String(matriz).replace(/\s+/g, '_')}` : '';
            const suffixTec = tecnica && tecnica !== 'ALL' ? `_${String(tecnica).replace(/\s+/g, '_')}` : '';
            const filename = `biologia_molecular_${fecha_desde}_al_${fecha_hasta}${suffixCT}${suffixCat}${suffixCentro}${suffixMatriz}${suffixTec}.xlsx`;

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            await biologiaMolecularService.streamExportExcel(res, {
                fecha_desde,
                fecha_hasta,
                id_lugaranalisis: Number(id_lugaranalisis) || 1,
                solo_menor_ct: isSoloMenorCT,
                categoria,
                centro,
                matriz,
                tecnica
            });
        } catch (error) {
            logger.error('Error en BiologiaMolecularController.exportExcel:', error);
            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    message: 'Error al exportar archivo Excel de Biología Molecular',
                    error: error.message
                });
            }
        }
    }

    /**
     * GET /api/biologia-molecular/export-csv
     * Exportación de archivo CSV compatible con Excel vía streaming HTTP
     */
    async exportCsv(req, res) {
        try {
            const { 
                fecha_desde = '2026-01-01', 
                fecha_hasta = '2026-12-31',
                id_lugaranalisis = 1,
                solo_menor_ct = 'false',
                categoria = 'ALL',
                centro = 'ALL',
                matriz = 'ALL',
                tecnica = 'ALL'
            } = req.query;

            const isSoloMenorCT = String(solo_menor_ct).toLowerCase() === 'true';

            const suffixCT = isSoloMenorCT ? '_menor_ct_max28' : '';
            const suffixCat = categoria && categoria !== 'ALL' ? `_${categoria.toLowerCase()}` : '';
            const suffixCentro = centro && centro !== 'ALL' ? `_${String(centro).replace(/\s+/g, '_')}` : '';
            const suffixMatriz = matriz && matriz !== 'ALL' ? `_${String(matriz).replace(/\s+/g, '_')}` : '';
            const suffixTec = tecnica && tecnica !== 'ALL' ? `_${String(tecnica).replace(/\s+/g, '_')}` : '';
            const filename = `biologia_molecular_${fecha_desde}_al_${fecha_hasta}${suffixCT}${suffixCat}${suffixCentro}${suffixMatriz}${suffixTec}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            await biologiaMolecularService.streamExportCsv(res, {
                fecha_desde,
                fecha_hasta,
                id_lugaranalisis: Number(id_lugaranalisis) || 1,
                solo_menor_ct: isSoloMenorCT,
                categoria,
                centro,
                matriz,
                tecnica
            });
        } catch (error) {
            logger.error('Error en BiologiaMolecularController.exportCsv:', error);
            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    message: 'Error al exportar archivo CSV de Biología Molecular',
                    error: error.message
                });
            }
        }
    }
}

export const biologiaMolecularController = new BiologiaMolecularController();
export default biologiaMolecularController;
