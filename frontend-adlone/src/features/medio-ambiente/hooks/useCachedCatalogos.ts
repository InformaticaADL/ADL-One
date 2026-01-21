import { useCallback } from 'react';
import { useCatalogos } from '../context/CatalogosContext';
import { catalogosService } from '../services/catalogos.service';
import type { LugarAnalisis, EmpresaServicio, Cliente, Contacto, Centro } from '../services/catalogos.service';

/**
 * Custom hook that provides cached access to all catalog services
 * Uses CatalogosContext for caching and deduplication
 */
export const useCachedCatalogos = () => {
    const { getCatalogo, isLoading, invalidateCache } = useCatalogos();

    // Independent catalogs (no parameters)
    const getLugaresAnalisis = useCallback(async (): Promise<LugarAnalisis[]> => {
        return getCatalogo('lugares-analisis', () => catalogosService.getLugaresAnalisis());
    }, [getCatalogo]);

    const getEmpresasServicio = useCallback(async (sedeId?: number): Promise<EmpresaServicio[]> => {
        const key = `empresas-servicio${sedeId ? `-${sedeId}` : ''}`;
        return getCatalogo(key, () => catalogosService.getEmpresasServicio(sedeId));
    }, [getCatalogo]);

    const getClientes = useCallback(async (empresaId?: number): Promise<Cliente[]> => {
        const key = `clientes${empresaId ? `-${empresaId}` : ''}`;
        return getCatalogo(key, () => catalogosService.getClientes(empresaId));
    }, [getCatalogo]);

    const getContactos = useCallback(async (clienteId?: number): Promise<Contacto[]> => {
        const key = `contactos${clienteId ? `-${clienteId}` : ''}`;
        return getCatalogo(key, () => catalogosService.getContactos(clienteId));
    }, [getCatalogo]);

    const getCentros = useCallback(async (clienteId?: number): Promise<Centro[]> => {
        const key = `centros${clienteId ? `-${clienteId}` : ''}`;
        return getCatalogo(key, () => catalogosService.getCentros(clienteId));
    }, [getCatalogo]);

    const getObjetivosMuestreo = useCallback(async (clienteId?: number): Promise<any[]> => {
        const key = `objetivos-muestreo${clienteId ? `-${clienteId}` : ''}`;
        return getCatalogo(key, () => catalogosService.getObjetivosMuestreo(clienteId));
    }, [getCatalogo]);

    const getComponentesAmbientales = useCallback(async (): Promise<any[]> => {
        return getCatalogo('componentes-ambientales', () => catalogosService.getComponentesAmbientales());
    }, [getCatalogo]);

    const getSubAreas = useCallback(async (componenteId: string): Promise<any[]> => {
        return getCatalogo(`subareas-${componenteId}`, () => catalogosService.getSubAreas(componenteId));
    }, [getCatalogo]);

    const getInspectores = useCallback(async (): Promise<any[]> => {
        return getCatalogo('inspectores', () => catalogosService.getInspectores());
    }, [getCatalogo]);

    const getTiposMuestreo = useCallback(async (): Promise<any[]> => {
        return getCatalogo('tipos-muestreo', () => catalogosService.getTiposMuestreo());
    }, [getCatalogo]);

    const getTiposMuestra = useCallback(async (tipoMuestreoId: string): Promise<any[]> => {
        return getCatalogo(`tipos-muestra-${tipoMuestreoId}`, () => catalogosService.getTiposMuestra(tipoMuestreoId));
    }, [getCatalogo]);

    const getActividadesMuestreo = useCallback(async (tipoMuestraId: string): Promise<any[]> => {
        return getCatalogo(`actividades-muestreo-${tipoMuestraId}`, () => catalogosService.getActividadesMuestreo(tipoMuestraId));
    }, [getCatalogo]);

    const getTiposDescarga = useCallback(async (): Promise<any[]> => {
        return getCatalogo('tipos-descarga', () => catalogosService.getTiposDescarga());
    }, [getCatalogo]);

    const getModalidades = useCallback(async (): Promise<any[]> => {
        return getCatalogo('modalidades', () => catalogosService.getModalidades());
    }, [getCatalogo]);

    const getCargos = useCallback(async (): Promise<any[]> => {
        return getCatalogo('cargos', () => catalogosService.getCargos());
    }, [getCatalogo]);

    const getFrecuenciasPeriodo = useCallback(async (): Promise<any[]> => {
        return getCatalogo('frecuencias-periodo', () => catalogosService.getFrecuenciasPeriodo());
    }, [getCatalogo]);

    const getFormasCanal = useCallback(async (): Promise<any[]> => {
        return getCatalogo('formas-canal', () => catalogosService.getFormasCanal());
    }, [getCatalogo]);

    const getDispositivosHidraulicos = useCallback(async (): Promise<any[]> => {
        return getCatalogo('dispositivos-hidraulicos', () => catalogosService.getDispositivosHidraulicos());
    }, [getCatalogo]);

    // ===== Analysis Service Methods (Cached) =====
    const getNormativas = useCallback(async (): Promise<any[]> => {
        return getCatalogo('normativas', () => import('../services/analysis.service').then(m => m.analysisService.getNormativas()));
    }, [getCatalogo]);

    const getReferenciasByNormativa = useCallback(async (normativaId: string | number): Promise<any[]> => {
        const key = `referencias-${normativaId}`;
        return getCatalogo(key, () => import('../services/analysis.service').then(m => m.analysisService.getReferenciasByNormativa(normativaId)));
    }, [getCatalogo]);

    const getAnalysisByNormativaReferencia = useCallback(async (normativaId: string | number, referenciaId: string | number): Promise<any[]> => {
        const key = `analysis-${normativaId}-${referenciaId}`;
        return getCatalogo(key, () => import('../services/analysis.service').then(m => m.analysisService.getAnalysisByNormativaReferencia(normativaId, referenciaId)));
    }, [getCatalogo]);

    const getLaboratorios = useCallback(async (): Promise<any[]> => {
        return getCatalogo('laboratorios', () => import('../services/analysis.service').then(m => m.analysisService.getLaboratorios()));
    }, [getCatalogo]);

    const getTiposEntrega = useCallback(async (): Promise<any[]> => {
        return getCatalogo('tipos-entrega', () => import('../services/analysis.service').then(m => m.analysisService.getTiposEntrega()));
    }, [getCatalogo]);

    return {
        // Catalog getters
        getLugaresAnalisis,
        getEmpresasServicio,
        getClientes,
        getContactos,
        getCentros,
        getObjetivosMuestreo,
        getComponentesAmbientales,
        getSubAreas,
        getInspectores,
        getTiposMuestreo,
        getTiposMuestra,
        getActividadesMuestreo,
        getTiposDescarga,
        getModalidades,
        getCargos,
        getFrecuenciasPeriodo,
        getFormasCanal,
        getDispositivosHidraulicos,

        // Analysis getters
        getNormativas,
        getReferenciasByNormativa,
        getAnalysisByNormativaReferencia,
        getLaboratorios,
        getTiposEntrega,

        // Utility functions
        isLoading,
        invalidateCache
    };
};
