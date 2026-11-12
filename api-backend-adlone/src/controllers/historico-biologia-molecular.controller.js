import historicoBiologiaMolecularService from '../services/historico-biologia-molecular.service.js';
import logger from '../utils/logger.js';
import { errorResponse } from '../utils/response.js';

class HistoricoBiologiaMolecularController {

    /**
     * Validador de autorización para datos históricos
     * Solo permite al usuario FERNANDOB y a usuarios con perfil de Informática (INF_ACCESO)
     */
    verifyAccess(req, res) {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Usuario no autenticado', 401);
            return false;
        }

        const username = (user.username || user.nombre_usuario || '').trim().toUpperCase();
        const permissions = user.permissions || [];
        const roles = user.roles || [];
        const isFernandoB = username === 'FERNANDOB';
        const isInformatica = permissions.includes('INF_ACCESO') ||
            user.role === 'informatica' ||
            roles.includes('informatica') ||
            roles.includes('admin') ||
            permissions.includes('AI_ACCESO');

        if (!isFernandoB && !isInformatica) {
            logger.warn(`Acceso denegado a histórico para usuario: ${username}`);
            errorResponse(res, 'Acceso denegado: solo el usuario FERNANDOB y usuarios de Informática tienen permiso para consultar la data histórica.', 403);
            return false;
        }

        return true;
    }

    /**
     * GET /api/biologia-molecular/historico/muestras
     */
    async getConsultaHistorico(req, res) {
        try {
            if (!this.verifyAccess(req, res)) return;

            const {
                fecha_desde = '2006-01-01',
                fecha_hasta = '2016-12-31',
                ano,
                sede,
                fuente_origen,
                resultado = 'ALL',
                centro = 'ALL',
                busqueda = '',
                solo_menor_ct = 'false',
                limite = 50000
            } = req.query;

            const isSoloMenorCT = String(solo_menor_ct).toLowerCase() === 'true';
            const maxLimit = Number(limite) || 50000;

            const data = await historicoBiologiaMolecularService.getConsultaHistorico({
                fecha_desde,
                fecha_hasta,
                ano,
                sede,
                fuente_origen,
                resultado,
                centro,
                busqueda,
                solo_menor_ct: isSoloMenorCT,
                limite: maxLimit,
                fresco: req.query.fresco === '1'
            });

            const isTruncated = !isSoloMenorCT && maxLimit > 0 && data.length >= maxLimit;
            const totalCount = isTruncated
                ? await historicoBiologiaMolecularService.countConsultaHistorico({
                    fecha_desde,
                    fecha_hasta,
                    ano,
                    sede,
                    fuente_origen,
                    resultado,
                    centro,
                    busqueda
                })
                : data.length;

            return res.status(200).json({
                success: true,
                count: data.length,
                totalCount: Math.max(totalCount, data.length),
                isTruncated,
                limite: maxLimit,
                filters: {
                    fecha_desde,
                    fecha_hasta,
                    ano,
                    sede,
                    fuente_origen,
                    resultado,
                    centro,
                    busqueda
                },
                data
            });
        } catch (error) {
            logger.error('Error en HistoricoBiologiaMolecularController.getConsultaHistorico:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al consultar data histórica en LaboratorioADLHistorico',
                error: error.message
            });
        }
    }

    /**
     * GET /api/biologia-molecular/historico/filtros
     */
    async getFiltrosHistorico(req, res) {
        try {
            if (!this.verifyAccess(req, res)) return;

            const filtros = await historicoBiologiaMolecularService.getFiltrosHistorico();
            return res.status(200).json({
                success: true,
                data: filtros
            });
        } catch (error) {
            logger.error('Error en HistoricoBiologiaMolecularController.getFiltrosHistorico:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al obtener filtros históricos',
                error: error.message
            });
        }
    }

    /**
     * GET /api/biologia-molecular/historico/export-excel
     */
    async exportExcel(req, res) {
        try {
            if (!this.verifyAccess(req, res)) return;

            const {
                fecha_desde = '2006-01-01',
                fecha_hasta = '2016-12-31',
                ano,
                sede,
                fuente_origen,
                resultado = 'ALL',
                centro = 'ALL',
                busqueda = '',
                solo_menor_ct = 'false'
            } = req.query;

            const isSoloMenorCT = String(solo_menor_ct).toLowerCase() === 'true';

            let yearPart = '';
            if (ano && String(ano) !== 'ALL') {
                yearPart = `_${ano}`;
            } else if (fecha_desde && fecha_hasta) {
                const yDesde = String(fecha_desde).slice(0, 4);
                const yHasta = String(fecha_hasta).slice(0, 4);
                yearPart = yDesde === yHasta ? `_${yDesde}` : `_${yDesde}_${yHasta}`;
            } else {
                yearPart = '_2006_2016';
            }

            const suffixSede = sede && sede !== 'ALL' ? `_${sede}` : '';
            const suffixCat = resultado && resultado !== 'ALL' ? `_${resultado.toLowerCase()}` : '';
            const suffixCT = isSoloMenorCT ? '_menor_ct' : '';
            const today = new Date().toISOString().split('T')[0];
            const filename = `historico_laboratorio${yearPart}${suffixSede}${suffixCat}${suffixCT}_${today}.xlsx`;

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            await historicoBiologiaMolecularService.streamExportExcel(res, {
                fecha_desde,
                fecha_hasta,
                ano,
                sede,
                fuente_origen,
                resultado,
                centro,
                busqueda,
                solo_menor_ct: isSoloMenorCT
            });
        } catch (error) {
            logger.error('Error en HistoricoBiologiaMolecularController.exportExcel:', error);
            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    message: 'Error al exportar archivo Excel histórico',
                    error: error.message
                });
            }
        }
    }

    /**
     * GET /api/biologia-molecular/historico/export-csv
     */
    async exportCsv(req, res) {
        try {
            if (!this.verifyAccess(req, res)) return;

            const {
                fecha_desde = '2006-01-01',
                fecha_hasta = '2016-12-31',
                ano,
                sede,
                fuente_origen,
                resultado = 'ALL',
                centro = 'ALL',
                busqueda = '',
                solo_menor_ct = 'false'
            } = req.query;

            const isSoloMenorCT = String(solo_menor_ct).toLowerCase() === 'true';

            let yearPart = '';
            if (ano && String(ano) !== 'ALL') {
                yearPart = `_${ano}`;
            } else if (fecha_desde && fecha_hasta) {
                const yDesde = String(fecha_desde).slice(0, 4);
                const yHasta = String(fecha_hasta).slice(0, 4);
                yearPart = yDesde === yHasta ? `_${yDesde}` : `_${yDesde}_${yHasta}`;
            } else {
                yearPart = '_2006_2016';
            }

            const suffixSede = sede && sede !== 'ALL' ? `_${sede}` : '';
            const suffixCat = resultado && resultado !== 'ALL' ? `_${resultado.toLowerCase()}` : '';
            const suffixCT = isSoloMenorCT ? '_menor_ct' : '';
            const today = new Date().toISOString().split('T')[0];
            const filename = `historico_laboratorio${yearPart}${suffixSede}${suffixCat}${suffixCT}_${today}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            await historicoBiologiaMolecularService.streamExportCsv(res, {
                fecha_desde,
                fecha_hasta,
                ano,
                sede,
                fuente_origen,
                resultado,
                centro,
                busqueda,
                solo_menor_ct: isSoloMenorCT
            });
        } catch (error) {
            logger.error('Error en HistoricoBiologiaMolecularController.exportCsv:', error);
            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    message: 'Error al exportar archivo CSV histórico',
                    error: error.message
                });
            }
        }
    }
}

export const historicoBiologiaMolecularController = new HistoricoBiologiaMolecularController();
// Bind methods to preserve `this` context when invoked as route handlers
historicoBiologiaMolecularController.getConsultaHistorico = historicoBiologiaMolecularController.getConsultaHistorico.bind(historicoBiologiaMolecularController);
historicoBiologiaMolecularController.getFiltrosHistorico = historicoBiologiaMolecularController.getFiltrosHistorico.bind(historicoBiologiaMolecularController);
historicoBiologiaMolecularController.exportExcel = historicoBiologiaMolecularController.exportExcel.bind(historicoBiologiaMolecularController);
historicoBiologiaMolecularController.exportCsv = historicoBiologiaMolecularController.exportCsv.bind(historicoBiologiaMolecularController);
historicoBiologiaMolecularController.verifyAccess = historicoBiologiaMolecularController.verifyAccess.bind(historicoBiologiaMolecularController);

export default historicoBiologiaMolecularController;
