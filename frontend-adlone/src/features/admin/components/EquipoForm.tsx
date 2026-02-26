import React, { useState, useEffect } from 'react';
import { equipoService, type Equipo, type EquipoHistorial } from '../services/equipo.service';
import { adminService } from '../../../services/admin.service';
import { useToast } from '../../../contexts/ToastContext';
import { HybridSelect } from '../../../components/ui/HybridSelect';
import { useNavStore } from '../../../store/navStore';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
    onCancel: () => void;
    onSave: () => void;
    initialData?: (Equipo & { requestId?: number; requestStatus?: string }) | null;
    pendingRequests?: any[];
    onRefreshSolicitudes?: () => void;
}

export const EquipoForm: React.FC<Props> = ({ onCancel, onSave, initialData, pendingRequests = [], onRefreshSolicitudes }) => {
    // Initial State
    const [formData, setFormData] = useState<any>({
        codigo: '',
        nombre: '',
        tipo: '',
        ubicacion: '',
        estado: '', // Empty for new equipment
        vigencia: '', // Empty for new equipment
        id_muestreador: '', // Empty for new equipment
        sigla: '',
        correlativo: 0,
        equipo_asociado: '', // Empty for new equipment
        tiene_fc: 'NO',

        visible_muestreador: 'NO',
        informe: 'NO',
        que_mide: '',
        unidad_medida_textual: '',
        observacion: '',
        error0: 0,
        error15: 0,
        error30: 0,
        version: initialData?.version || 'v1'
    });

    const [loading, setLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [error, setError] = useState('');
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [history, setHistory] = useState<EquipoHistorial[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [requestedChanges, setRequestedChanges] = useState<any>(null);
    const [generatingCode, setGeneratingCode] = useState(false);
    const [namesOptions, setNamesOptions] = useState<string[]>([]);
    const [tipoOptions, setTipoOptions] = useState<string[]>([]);

    const [queMideOptions, setQueMideOptions] = useState<string[]>([]);
    const [unidadesOptions, setUnidadesOptions] = useState<string[]>([]);
    const [sedeOptions, setSedeOptions] = useState<string[]>([]);
    const [estadoOptions, setEstadoOptions] = useState<string[]>([]);
    const [nameToSigla, setNameToSigla] = useState<Record<string, string>>({});
    const [rejectingSolicitud, setRejectingSolicitud] = useState<any>(null);
    const [adminFeedback, setAdminFeedback] = useState('');
    const [processingAction, setProcessingAction] = useState(false);
    const [attemptedSubmit, setAttemptedSubmit] = useState(false);
    const [lastRestoredVersion, setLastRestoredVersion] = useState<{ active: string, previous: string } | null>(null);
    const { hideNotification } = useNavStore();



    const { showToast } = useToast();
    const { hasPermission } = useAuth();
    const isGCMan = hasPermission('GC_ACCESO') || hasPermission('GC_EQUIPOS');
    const isMAMan = hasPermission('AI_MA_SOLICITUDES') || hasPermission('MA_A_GEST_EQUIPO');
    const isSuper = hasPermission('AI_MA_ADMIN_ACCESO');

    // Granular AI Permissions
    const canCreateEquipo = hasPermission('AI_MA_CREAR_EQUIPO') || isSuper;
    const canEditEquipo = hasPermission('AI_MA_EDITAR_EQUIPO') || isSuper;

    // Fetch equipment names when Tipo changes
    useEffect(() => {
        const fetchNames = async () => {
            if (formData.tipo) {
                try {
                    const res = await equipoService.getEquipos({ tipo: formData.tipo, limit: 1000 });
                    if (res && res.data) {
                        // Extract unique names and map to sigla
                        const namesSet = new Set<string>();
                        const siglaMap: Record<string, string> = {};

                        // Find a "template" equipment to auto-fill metadata
                        const template = res.data.find((e: Equipo) => e.que_mide || e.unidad_medida_textual);

                        res.data.forEach((e: Equipo) => {
                            if (e.nombre && e.nombre.trim().length > 0) {
                                namesSet.add(e.nombre.trim());
                                if (e.sigla) {
                                    siglaMap[e.nombre] = e.sigla;
                                }
                            }

                        });

                        setNamesOptions(Array.from(namesSet).sort());
                        setNameToSigla(siglaMap);

                        // Auto-fill logic
                        if (template) {
                            setFormData((prev: any) => {
                                // Only update if currently empty to avoid overwriting user input
                                if (!prev.que_mide && !prev.unidad_medida_textual) {
                                    return {
                                        ...prev,
                                        que_mide: template.que_mide || '',
                                        unidad_medida_textual: template.unidad_medida_textual || '',
                                        unidad_medida_sigla: template.unidad_medida_sigla || ''
                                    };
                                }
                                return prev;
                            });
                        }
                    }
                } catch (err) {
                    console.error('Error fetching names for type:', err);
                }
            } else {
                setNamesOptions([]);
                setNameToSigla({});
            }
        };
        fetchNames();
    }, [formData.tipo]);

    useEffect(() => {
        const fetchMuestreadoresAndCatalogs = async () => {
            try {
                // Fetch muestreadores
                const [mRes, eRes] = await Promise.all([
                    adminService.getMuestreadores('', 'ACTIVOS'),
                    equipoService.getEquipos({ limit: 1 }) // Get catalogs from any request
                ]);

                setMuestreadores(mRes.data || []);

                if (eRes.catalogs?.tipos) {
                    // Rigorous filter for empty/whitespace types
                    setTipoOptions(eRes.catalogs.tipos.filter((t: string) => t && typeof t === 'string' && t.trim().length > 0));
                }
                if (eRes.catalogs?.que_mide) {
                    setQueMideOptions(eRes.catalogs.que_mide.filter((t: string) => t && typeof t === 'string' && t.trim().length > 0));
                }
                if (eRes.catalogs?.unidades) {
                    setUnidadesOptions(eRes.catalogs.unidades.filter((t: string) => t && typeof t === 'string' && t.trim().length > 0));
                }
                if (eRes.catalogs?.sedes) {
                    setSedeOptions(eRes.catalogs.sedes.filter((t: string) => t && typeof t === 'string' && t.trim().length > 0));
                }
                if (eRes.catalogs?.estados) {
                    setEstadoOptions(eRes.catalogs.estados.filter((t: string) => t && typeof t === 'string' && t.trim().length > 0));
                }




            } catch (err) {
                console.error('Error loading initial catalogs', err);
            }
        };
        fetchMuestreadoresAndCatalogs();

        if (initialData) {
            const hasValidId = !!initialData.id_equipo && String(initialData.id_equipo) !== '0' && initialData.id_equipo !== 0 && String(initialData.id_equipo) !== 'null';
            const isTraspaso = initialData.requestId && hasValidId;
            const isAlta = initialData.requestId && !hasValidId;

            const loadAllData = async () => {
                setLoading(true);
                try {
                    let baseData = initialData;

                    // Si es un traspaso, primero traemos la ficha completa actual
                    if (isTraspaso) {
                        const equipRes = await equipoService.getEquipoById(initialData.id_equipo);
                        if (equipRes.success) {
                            baseData = { ...equipRes.data, ...initialData };
                            // Restore original vigencia if initialData didn't provide one (which is the case for Traspaso now)
                            if (!initialData.vigencia && equipRes.data.vigencia) {
                                baseData.vigencia = equipRes.data.vigencia;
                            }
                            setRequestedChanges({
                                nueva_ubicacion: initialData.ubicacion,
                                nuevo_responsable_id: initialData.id_muestreador,
                                vigencia: initialData.vigencia
                            });
                        }
                    } else if (isAlta) {
                        setRequestedChanges(initialData);
                    }

                    // Backend sends date as dd/MM/yyyy, convert to yyyy-MM-dd for input type="date"
                    let formattedDate = '';
                    if (baseData.vigencia) {
                        if (baseData.vigencia.includes('/')) {
                            const [day, month, year] = baseData.vigencia.split('/');
                            formattedDate = `${year}-${month}-${day}`;
                        } else {
                            try {
                                formattedDate = new Date(baseData.vigencia).toISOString().split('T')[0];
                            } catch (e) {
                                formattedDate = '';
                            }
                        }
                    }

                    setFormData({
                        ...baseData,
                        vigencia: formattedDate,
                        id_muestreador: isTraspaso ? (initialData.id_muestreador || baseData.id_muestreador) : (isAlta ? (initialData.id_muestreador || 0) : baseData.id_muestreador),
                        error0: isNaN(Number(baseData.error0)) ? 0 : Number(baseData.error0),
                        error15: isNaN(Number(baseData.error15)) ? 0 : Number(baseData.error15),
                        error30: isNaN(Number(baseData.error30)) ? 0 : Number(baseData.error30),
                        equipo_asociado: (!baseData.equipo_asociado || baseData.equipo_asociado === 0) ? 'No Aplica' : baseData.equipo_asociado,
                        correlativo: isNaN(Number(baseData.correlativo)) ? 0 : Number(baseData.correlativo),
                        version: baseData.version || 'v1'
                    });

                    // Fetch History for Traspaso/Edit
                    const hasValidIdBase = !!baseData.id_equipo && String(baseData.id_equipo) !== '0' && baseData.id_equipo !== 0 && String(baseData.id_equipo) !== 'null';
                    if (hasValidIdBase) {
                        setLoadingHistory(true);
                        const histRes = await equipoService.getEquipoHistorial(baseData.id_equipo);
                        if (histRes.success) {
                            setHistory(histRes.data || []);
                        }
                        setLoadingHistory(false);
                    }
                } catch (err) {
                    console.error('Error loading full data', err);
                    showToast({ type: 'error', message: 'Error al cargar datos completos del equipo' });
                } finally {
                    setLoading(false);
                }
            };

            loadAllData();
        }
    }, [initialData]);

    const handleRestore = async (h: any) => {
        if (!initialData?.id_equipo) return;

        setLoading(true);
        setError('');
        try {
            const res = await equipoService.restoreVersion(initialData.id_equipo, h.id_historial);
            if (res.success) {
                // Fetch the updated equipment data and refresh history
                const [equipRes, histRes] = await Promise.all([
                    equipoService.getEquipoById(initialData.id_equipo),
                    equipoService.getEquipoHistorial(initialData.id_equipo)
                ]);

                if (equipRes.success) {
                    const baseData = equipRes.data;
                    let formattedDate = '';
                    if (baseData.vigencia) {
                        if (baseData.vigencia.includes('/')) {
                            const [day, month, year] = baseData.vigencia.split('/');
                            formattedDate = `${year}-${month}-${day}`;
                        } else {
                            try {
                                formattedDate = new Date(baseData.vigencia).toISOString().split('T')[0];
                            } catch (e) {
                                formattedDate = '';
                            }
                        }
                    }

                    setFormData({
                        ...baseData,
                        vigencia: formattedDate,
                        error0: isNaN(Number(baseData.error0)) ? 0 : Number(baseData.error0),
                        error15: isNaN(Number(baseData.error15)) ? 0 : Number(baseData.error15),
                        error30: isNaN(Number(baseData.error30)) ? 0 : Number(baseData.error30),
                        equipo_asociado: (!baseData.equipo_asociado || baseData.equipo_asociado === 0) ? 'No Aplica' : baseData.equipo_asociado,
                        correlativo: isNaN(Number(baseData.correlativo)) ? 0 : Number(baseData.correlativo),
                        version: baseData.version || 'v1'
                    });
                }

                if (histRes.success) {
                    setHistory(histRes.data || []);
                }

                setLastRestoredVersion({ active: h.version, previous: formData.version });

                showToast({
                    type: 'success',
                    message: `Versión ${h.version} habilitada correctamente. Los datos anteriores se movieron al historial.`,
                    duration: 5000
                });

                if (onRefreshSolicitudes) onRefreshSolicitudes();
            }
        } catch (err: any) {
            console.error('Error restoring version:', err);
            showToast({
                type: 'error',
                message: err.response?.data?.message || 'Error al habilitar la versión',
                duration: 5000
            });
        } finally {
            setLoading(false);
        }
    };

    // Matching logic for UI highlighting (optional)
    const matchingVersion = React.useMemo<EquipoHistorial | null>(() => {
        return null; // Simplified: we no longer need to track a "pending" match for the save button
    }, []);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setIsRestoring(false);
        // Reset attemptedSubmit when user types to give immediate feedback if they want, 
        // though keeping it true also works. Let's keep it true for persistence until success.

        let finalValue: any = value;
        if (type === 'checkbox') {
            // For checkboxes acting as YES/NO
            const checked = (e.target as HTMLInputElement).checked;
            finalValue = checked ? 'SI' : 'NO';
        }
        setFormData((prev: any) => ({ ...prev, [name]: finalValue }));
    };

    // Checkbox handler helper for "SI"/"NO" strings
    const handleCheckboxChange = (name: keyof Equipo) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsRestoring(false);
        setFormData((prev: any) => ({ ...prev, [name]: e.target.checked ? 'SI' : 'NO' }));
    };

    // Auto-correlative and Code Refresh logic (both for NEW and EXISTING equipment)
    useEffect(() => {
        if (isRestoring) return; // IMPORTANT: Don't overwrite codes/logic if we are previewing a historical version

        const hasValidIdInit = !!initialData?.id_equipo && String(initialData.id_equipo) !== '0' && initialData.id_equipo !== 0 && String(initialData.id_equipo) !== 'null';
        const isNew = !hasValidIdInit;

        if (isNew) {
            // Logic for NEW equipment: full code suggestion from backend
            // User request: Don't show code until Name is selected
            if (formData.tipo && formData.ubicacion && formData.nombre) {
                const timer = setTimeout(async () => {
                    setGeneratingCode(true);
                    try {
                        // Pass nombre to get specific sigla (e.g. Balanza Analitica -> BAN instead of BAL)
                        const res = await equipoService.suggestNextCode(formData.tipo, formData.ubicacion, formData.nombre);
                        if (res.success && res.data.suggestedCode) {
                            setFormData((prev: any) => ({
                                ...prev,
                                sigla: res.data.sigla,
                                correlativo: res.data.correlativo,
                                codigo: res.data.suggestedCode
                            }));
                        }
                    } catch (err) {
                        console.error('Error fetching suggested code', err);
                    } finally {
                        setGeneratingCode(false);
                    }
                }, 600); // Debounce
                return () => clearTimeout(timer);
            }
        } else {
            // Logic for EXISTING equipment: update only the location suffix in the code
            if (formData.sigla && formData.correlativo && formData.ubicacion) {
                const formattedCorr = formData.correlativo < 10 ? `0${formData.correlativo}` : `${formData.correlativo}`;
                const newCode = `${formData.sigla}.${formattedCorr}/MA.${formData.ubicacion}`;

                // Only update if it actually changed to avoid infinite loops
                if (formData.codigo !== newCode) {
                    setFormData((prev: any) => ({ ...prev, codigo: newCode }));
                }
            }
        }
    }, [formData.tipo, formData.ubicacion, formData.nombre, formData.sigla, formData.correlativo, initialData?.id_equipo, isRestoring]);

    const isFormValid = !!(
        formData.nombre &&
        formData.tipo &&
        formData.ubicacion &&
        formData.estado &&
        formData.codigo &&
        formData.vigencia &&
        !generatingCode
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setAttemptedSubmit(true);
        if (isFormValid) {
            setShowSaveConfirm(true);
        } else {
            showToast({
                type: 'error',
                message: 'Por favor complete todos los campos obligatorios marcados en rojo',
                duration: 5000
            });
        }
    };

    const handleConfirmSave = async () => {
        setLoading(true);
        setError('');
        setShowSaveConfirm(false);

        try {
            const dataToSend = {
                ...formData,
                equipo_asociado: formData.equipo_asociado === 'No Aplica' ? 0 : Number(formData.equipo_asociado)
            };

            const hasValidIdInit = !!initialData?.id_equipo && String(initialData.id_equipo) !== '0' && initialData.id_equipo !== 0 && String(initialData.id_equipo) !== 'null';

            if (hasValidIdInit) {
                await equipoService.updateEquipo(initialData!.id_equipo, dataToSend);

                // Approve request if applicable
                if (initialData.requestId) {
                    const needsTechnicalReview = initialData.requestStatus === 'PENDIENTE_TECNICA';
                    const targetStatus = needsTechnicalReview ? 'PENDIENTE_CALIDAD' : 'APROBADO';
                    const feedback = needsTechnicalReview ? 'Manual: Actualizado por Área Técnica y derivado a Calidad' : 'Equipo actualizado por administrador';

                    await adminService.updateSolicitudStatus(initialData.requestId, targetStatus, feedback);

                    if (needsTechnicalReview) {
                        hideNotification(`${initialData.requestId}-PENDIENTE_TECNICA`);
                    }
                }

                showToast({
                    type: 'success',
                    message: initialData.requestId
                        ? (initialData.requestStatus === 'PENDIENTE_TECNICA' ? 'Equipo actualizado y derivado a Calidad' : 'Equipo actualizado y solicitud aprobada')
                        : 'Equipo actualizado correctamente',
                    duration: 5000
                });
            } else {
                await equipoService.createEquipo(dataToSend);

                // Si viene de una solicitud (ALTA), aprobarla automáticamente o derivar
                if (initialData && (initialData as any).requestId) {
                    const needsTechnicalReview = (initialData as any).requestStatus === 'PENDIENTE_TECNICA';
                    const targetStatus = needsTechnicalReview ? 'PENDIENTE_CALIDAD' : 'APROBADO';
                    const feedback = needsTechnicalReview ? 'Manual: Creado por Área Técnica y derivado a Calidad' : 'Equipo creado y registrado por administrador';

                    await adminService.updateSolicitudStatus((initialData as any).requestId, targetStatus, feedback);

                    if (needsTechnicalReview) {
                        hideNotification(`${(initialData as any).requestId}-PENDIENTE_TECNICA`);
                    }
                }

                showToast({
                    type: 'success',
                    message: (initialData as any)?.requestId
                        ? ((initialData as any).requestStatus === 'PENDIENTE_TECNICA' ? 'Equipo creado y derivado a Calidad' : 'Equipo creado y solicitud aprobada')
                        : 'Equipo creado correctamente',
                    duration: 10000
                });
            }
            onSave();
        } catch (err: any) {
            console.error(err);
            const errorMsg = err.response?.data?.message || 'Error al guardar equipo';
            setError(errorMsg);
            showToast({
                type: 'error',
                message: errorMsg,
                duration: 10000
            });
        } finally {
            setLoading(false);
        }
    };

    const handleApproveAction = async (sol: any) => {
        setProcessingAction(true);
        try {
            if (sol.tipo_solicitud === 'TRASPASO') {
                const datos = sol.datos_json;
                // Formatear fecha si es necesario
                let formattedDate = formData.vigencia;
                if (datos.vigencia) {
                    if (datos.vigencia.includes('/')) {
                        const [day, month, year] = datos.vigencia.split('/');
                        formattedDate = `${year}-${month}-${day}`;
                    } else {
                        formattedDate = datos.vigencia;
                    }
                }

                const updatedData = {
                    ...formData,
                    ubicacion: datos.nueva_ubicacion || formData.ubicacion,
                    id_muestreador: datos.nuevo_responsable_id || formData.id_muestreador,
                    vigencia: formattedDate
                };

                await equipoService.updateEquipo(formData.id_equipo, updatedData);

                const needsTechnicalReview = sol.estado === 'PENDIENTE_TECNICA';
                const targetStatus = needsTechnicalReview ? 'PENDIENTE_CALIDAD' : 'APROBADO';
                const feedback = needsTechnicalReview ? 'Derivado a Calidad desde formulario' : 'Aprobado desde formulario de equipo';

                await adminService.updateSolicitudStatus(
                    sol.id_solicitud,
                    targetStatus,
                    feedback,
                    undefined,
                    formData.id_equipo,
                    'APROBADO'
                );
                hideNotification(`${sol.id_solicitud}-${sol.estado}`);

                showToast({ type: 'success', message: needsTechnicalReview ? 'Solicitud derivada a Calidad' : 'Traspaso aprobado y equipo actualizado' });
                if (onRefreshSolicitudes) onRefreshSolicitudes();
                onSave(); // Refrescar lista y cerrar
            }
            else if (sol.tipo_solicitud === 'BAJA') {
                await equipoService.deleteEquipo(formData.id_equipo);

                // Si la solicitud tiene múltiples equipos, marcar este como procesado
                let updatedDatosJson = sol.datos_json;
                if (sol.datos_json?.equipos_baja) {
                    const updatedBajas = sol.datos_json.equipos_baja.map((eb: any) =>
                        String(eb.id) === String(formData.id_equipo) ? { ...eb, procesado: true } : eb
                    );
                    updatedDatosJson = { ...sol.datos_json, equipos_baja: updatedBajas };

                    const allProcesado = updatedBajas.every((eb: any) => eb.procesado);
                    if (allProcesado) {
                        await adminService.updateSolicitudStatus(sol.id_solicitud, 'APROBADO', 'Todos los equipos dados de baja', updatedDatosJson, formData.id_equipo, 'APROBADO');
                        hideNotification(`${sol.id_solicitud}-PENDIENTE`);
                    } else {
                        // Actualizar solo el JSON para mantener el progreso
                        await adminService.updateSolicitudStatus(sol.id_solicitud, 'PENDIENTE', 'Baja parcial procesada', updatedDatosJson, formData.id_equipo, 'APROBADO');
                    }
                } else {
                    await adminService.updateSolicitudStatus(sol.id_solicitud, 'APROBADO', 'Baja aprobada');
                    hideNotification(`${sol.id_solicitud}-PENDIENTE`);
                }

                showToast({ type: 'success', message: 'Baja procesada correctamente' });
                if (onRefreshSolicitudes) onRefreshSolicitudes();
                onSave();
            }
            else if (sol.tipo_solicitud === 'ALTA' && sol.datos_json?.isReactivation) {
                // Reactivación
                await equipoService.updateEquipo(formData.id_equipo, { ...formData, estado: 'Activo' });

                let updatedDatosJson = sol.datos_json;
                if (sol.datos_json?.equipos_alta) {
                    const updatedAltas = sol.datos_json.equipos_alta.map((ea: any) =>
                        String(ea.id) === String(formData.id_equipo) ? { ...ea, procesado: true } : ea
                    );
                    updatedDatosJson = { ...sol.datos_json, equipos_alta: updatedAltas };

                    const allProcesado = updatedAltas.every((ea: any) => ea.procesado);
                    if (allProcesado) {
                        await adminService.updateSolicitudStatus(sol.id_solicitud, 'APROBADO', 'Todos los equipos reactivados', updatedDatosJson, formData.id_equipo, 'APROBADO');
                        hideNotification(`${sol.id_solicitud}-PENDIENTE`);
                    } else {
                        await adminService.updateSolicitudStatus(sol.id_solicitud, 'PENDIENTE', 'Reactivación parcial procesada', updatedDatosJson, formData.id_equipo, 'APROBADO');
                    }
                }

                showToast({ type: 'success', message: 'Equipo reactivado correctamente' });
                if (onRefreshSolicitudes) onRefreshSolicitudes();
                onSave();
            }
        } catch (err) {
            console.error(err);
            showToast({ type: 'error', message: 'Error al procesar la acción' });
        } finally {
            setProcessingAction(false);
        }
    };

    const confirmReject = async () => {
        if (!rejectingSolicitud) return;
        setProcessingAction(true);
        try {
            let updatedDatosJson = rejectingSolicitud.datos_json;
            const isBulk = (rejectingSolicitud.tipo_solicitud === 'BAJA' && rejectingSolicitud.datos_json?.equipos_baja) ||
                (rejectingSolicitud.tipo_solicitud === 'ALTA' && rejectingSolicitud.datos_json?.isReactivation && rejectingSolicitud.datos_json?.equipos_alta);

            if (isBulk) {
                const field = rejectingSolicitud.tipo_solicitud === 'BAJA' ? 'equipos_baja' : 'equipos_alta';
                const updatedList = rejectingSolicitud.datos_json[field].map((e: any) =>
                    String(e.id) === String(formData.id_equipo) ? { ...e, procesado: true, rechazado: true } : e
                );
                updatedDatosJson = { ...rejectingSolicitud.datos_json, [field]: updatedList };

                const allProcessed = updatedList.every((e: any) => e.procesado);
                const anyApproved = updatedList.some((e: any) => e.procesado && !e.rechazado);

                if (allProcessed) {
                    const finalStatus = anyApproved ? 'APROBADO' : 'RECHAZADO';
                    await adminService.updateSolicitudStatus(rejectingSolicitud.id_solicitud, finalStatus, adminFeedback || 'Rechazado desde formulario de equipo', updatedDatosJson, formData.id_equipo, 'RECHAZADO');
                    hideNotification(`${rejectingSolicitud.id_solicitud}-PENDIENTE`);
                } else {
                    await adminService.updateSolicitudStatus(rejectingSolicitud.id_solicitud, 'PENDIENTE', adminFeedback || 'Rechazo parcial procesado', updatedDatosJson, formData.id_equipo, 'RECHAZADO');
                }
            } else {
                await adminService.updateSolicitudStatus(rejectingSolicitud.id_solicitud, 'RECHAZADO', adminFeedback || 'Solicitud rechazada por el administrador', undefined, formData.id_equipo, 'RECHAZADO');
                hideNotification(`${rejectingSolicitud.id_solicitud}-PENDIENTE`);
            }

            showToast({ type: 'info', message: 'Solicitud procesada' });
            if (onRefreshSolicitudes) onRefreshSolicitudes();
            setRejectingSolicitud(null);
            setAdminFeedback('');
            // Si era una baja y fue la que estamos viendo, cerrar el formulario podría ser bueno pero
            // handleApproveAction llama a onSave(). Hagamos lo mismo si era el último.
            if (isBulk) {
                const allProcessed = updatedDatosJson[rejectingSolicitud.tipo_solicitud === 'BAJA' ? 'equipos_baja' : 'equipos_alta'].every((e: any) => e.procesado);
                if (allProcessed) onSave();
            } else {
                onSave();
            }
        } catch (err) {
            console.error(err);
            showToast({ type: 'error', message: 'Error al rechazar solicitud' });
        } finally {
            setProcessingAction(false);
        }
    };

    return (
        <div className="card admin-card" style={{ background: '#f4f4f5' }}>
            <div className="header-premium-container">
                <div className="header-title-area">
                    <h3 className="header-title-text">
                        {requestedChanges?.isReactivation
                            ? 'Activación de Equipo'
                            : (initialData?.id_equipo ? 'Editar Equipo' : 'Nuevo Equipo')
                        }
                    </h3>
                </div>

                <div className="header-actions-area">
                    <div className="header-actions-left">
                        <button type="button" onClick={onCancel} className="btn-back header-btn" style={{ margin: 0, padding: '0.5rem 1rem' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                            Volver
                        </button>
                    </div>

                    <div className="header-actions-right">
                        {(() => {
                            const hasId = !!initialData?.id_equipo && String(initialData.id_equipo) !== '0' && initialData.id_equipo !== 0 && String(initialData.id_equipo) !== 'null';
                            return hasId && (
                                <button
                                    type="button"
                                    className="btn-secondary header-btn"
                                    style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                                    onClick={() => setShowHistory(!showHistory)}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    Historial
                                </button>
                            )
                        })()}
                    </div>
                </div>

                <div className="header-version-area">
                    {initialData && formData.version && (
                        <span className="header-version-pill">
                            Versión Activa: {formData.version}
                        </span>
                    )}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="admin-form">
                {error && <div className="error-message mb-4">{error}</div>}

                {/* Integrated Pending Requests Section */}
                {pendingRequests.length > 0 && (
                    <div style={{
                        marginBottom: '2rem',
                        background: '#fff7ed',
                        border: '1px solid #ffedd5',
                        borderRadius: '12px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            background: '#ffedd5',
                            padding: '0.75rem 1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: '#9a3412',
                            fontWeight: 700,
                            fontSize: '0.9rem'
                        }}>
                            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                            SOLICITUDES PENDIENTES PARA ESTE EQUIPO
                        </div>
                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {pendingRequests.map(sol => {
                                // Check if the current equipment is already processed in this bulk request
                                let isProcessed = false;
                                let isRejected = false;
                                if (sol.tipo_solicitud === 'BAJA' && sol.datos_json?.equipos_baja) {
                                    const eq = sol.datos_json.equipos_baja.find((e: any) => String(e.id) === String(formData.id_equipo));
                                    isProcessed = eq?.procesado || false;
                                    isRejected = eq?.rechazado || false;
                                } else if (sol.tipo_solicitud === 'ALTA' && sol.datos_json?.isReactivation && sol.datos_json?.equipos_alta) {
                                    const eq = sol.datos_json.equipos_alta.find((e: any) => String(e.id) === String(formData.id_equipo));
                                    isProcessed = eq?.procesado || false;
                                    isRejected = eq?.rechazado || false;
                                }

                                return (
                                    <div key={sol.id_solicitud} style={{
                                        background: isProcessed ? '#f8fafc' : 'white',
                                        padding: '1rem',
                                        borderRadius: '8px',
                                        border: isProcessed ? '1px solid #e2e8f0' : '1px solid #fed7aa',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        opacity: isProcessed ? 0.7 : 1
                                    }}>
                                        <div style={{ textDecoration: isProcessed ? 'line-through' : 'none' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 'bold',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    background: sol.tipo_solicitud === 'ALTA' ? '#dcfce7' : sol.tipo_solicitud === 'TRASPASO' ? '#dbeafe' : '#fee2e2',
                                                    color: sol.tipo_solicitud === 'ALTA' ? '#166534' : sol.tipo_solicitud === 'TRASPASO' ? '#1e40af' : '#991b1b'
                                                }}>
                                                    {sol.tipo_solicitud === 'ALTA' ? (sol.datos_json?.isReactivation ? 'ACTIVACIÓN' : 'CREACIÓN') : sol.tipo_solicitud}
                                                </span>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                    {new Date(sol.fecha_solicitud).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                                                <strong>Motivo:</strong> {sol.datos_json?.motivo || 'Sin motivo'}
                                            </div>
                                            {sol.tipo_solicitud === 'ALTA' && sol.datos_json?.isReactivation && sol.datos_json?.equipos_alta && (
                                                <div style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 700, marginTop: '2px' }}>
                                                    📅 Vigencia Propuesta: {
                                                        (() => {
                                                            const item = sol.datos_json.equipos_alta.find((e: any) => String(e.id) === String(formData.id_equipo));
                                                            return item?.vigencia || 'No especificada';
                                                        })()
                                                    }
                                                </div>
                                            )}
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                Solicitado por: {sol.nombre_solicitante}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {!isProcessed ? (
                                                <>
                                                    {/* Technical Area or Super can Derive if EN_REVISION_TECNICA (already accepted for review) */}
                                                    {(sol.estado === 'EN_REVISION_TECNICA' && (isMAMan || isSuper)) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleApproveAction(sol)}
                                                            disabled={processingAction}
                                                            style={{
                                                                padding: '0.5rem 1rem',
                                                                background: '#16a34a',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                minWidth: '120px'
                                                            }}
                                                        >
                                                            {processingAction ? '...' : 'Derivar a Calidad'}
                                                        </button>
                                                    )}
                                                    {/* Quality Area or Super can Approve Final if PENDIENTE_CALIDAD */}
                                                    {(sol.estado === 'PENDIENTE_CALIDAD' && (isGCMan || isSuper)) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleApproveAction(sol)}
                                                            disabled={processingAction}
                                                            style={{
                                                                padding: '0.5rem 1rem',
                                                                background: '#16a34a',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                minWidth: '120px'
                                                            }}
                                                        >
                                                            {processingAction ? '...' : 'Aprobar Final'}
                                                        </button>
                                                    )}
                                                    {/* Retrocompatibility/Fallback for PENDIENTE */}
                                                    {sol.estado === 'PENDIENTE' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleApproveAction(sol)}
                                                            disabled={processingAction}
                                                            style={{
                                                                padding: '0.5rem 1rem',
                                                                background: '#16a34a',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {processingAction ? '...' : 'Aprobar'}
                                                        </button>
                                                    )}

                                                    {/* Rechazar button: also gated by permission for the current state */}
                                                    {((sol.estado === 'PENDIENTE_TECNICA' && (isMAMan || isSuper)) ||
                                                        (sol.estado === 'PENDIENTE_CALIDAD' && (isGCMan || isSuper)) ||
                                                        sol.estado === 'PENDIENTE') && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setRejectingSolicitud(sol)}
                                                                disabled={processingAction}
                                                                style={{
                                                                    padding: '0.5rem 1rem',
                                                                    background: 'white',
                                                                    color: '#dc2626',
                                                                    border: '1px solid #fecaca',
                                                                    borderRadius: '6px',
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                Rechazar
                                                            </button>
                                                        )}
                                                </>
                                            ) : (
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    color: isRejected ? '#dc2626' : '#16a34a',
                                                    background: isRejected ? '#fee2e2' : '#dcfce7',
                                                    padding: '4px 10px',
                                                    borderRadius: '6px'
                                                }}>
                                                    {isRejected ? 'RECHAZADO' : 'PROCESADO'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Requested Changes Banner */}
                {initialData?.requestId && requestedChanges && (
                    <div style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '12px',
                        padding: '1.25rem',
                        marginBottom: '2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e40af', fontWeight: 700 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            Datos Solicitados por Medio Ambiente
                        </div>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e40af' }}>
                            El formulario se ha rellenado automáticamente con los siguientes cambios sugeridos:
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
                            {requestedChanges.nueva_ubicacion && (
                                <div style={{ background: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Nueva Ubicación</span>
                                    <span style={{ fontWeight: 600, color: '#1e40af' }}>{requestedChanges.nueva_ubicacion}</span>
                                </div>
                            )}
                            {requestedChanges.nuevo_responsable_id && (
                                <div style={{ background: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Nuevo Responsable</span>
                                    <span style={{ fontWeight: 600, color: '#1e40af' }}>
                                        {muestreadores.find(m => m.id_muestreador === requestedChanges.nuevo_responsable_id)?.nombre_muestreador || 'Muestreador #' + requestedChanges.nuevo_responsable_id}
                                    </span>
                                </div>
                            )}
                            {requestedChanges.vigencia && (
                                <div style={{ background: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Nueva Vigencia</span>
                                    <span style={{ fontWeight: 600, color: '#1e40af' }}>{requestedChanges.vigencia}</span>
                                </div>
                            )}
                            {/* For ALTA cases */}
                            {!requestedChanges.nueva_ubicacion && requestedChanges.nombre && (
                                <>
                                    <div style={{ background: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Nombre</span>
                                        <span style={{ fontWeight: 600, color: '#1e40af' }}>{requestedChanges.nombre}</span>
                                    </div>
                                    <div style={{ background: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Tipo</span>
                                        <span style={{ fontWeight: 600, color: '#1e40af' }}>{requestedChanges.tipo}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Historial de Versiones Section (Conditional) */}
                {showHistory && (
                    <div className="form-section section-history" style={{ borderLeft: '4px solid #3b82f6' }}>
                        <h4 className="section-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Historial de Versiones (Últimas 7)
                        </h4>
                        <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                            <table className="admin-table-compact">
                                <thead>
                                    <tr>
                                        <th>Versión</th>
                                        <th>Fecha Cambio</th>
                                        <th>Usuario</th>
                                        <th>Código</th>
                                        <th>Nombre</th>
                                        <th>Sede</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingHistory ? (
                                        <tr><td colSpan={7} style={{ textAlign: 'center' }}>Cargando historial...</td></tr>
                                    ) : history.length === 0 && !lastRestoredVersion ? (
                                        <tr><td colSpan={7} style={{ textAlign: 'center' }}>No hay versiones anteriores.</td></tr>
                                    ) : (
                                        [{
                                            id_historial: 'current',
                                            version: formData.version,
                                            fecha_cambio: new Date().toISOString(),
                                            nombre_usuario_cambio: 'Actual',
                                            codigo: formData.codigo,
                                            nombre: formData.nombre,
                                            ubicacion: formData.ubicacion,
                                            isCurrent: true
                                        }, ...history].map((h: any) => {
                                            const isCurrent = h.isCurrent;
                                            const isPreviousRestored = lastRestoredVersion?.previous === h.version;

                                            let bgColor = 'transparent';
                                            let borderLeftColor = 'none';
                                            if (isCurrent) {
                                                bgColor = '#dcfce7';
                                                borderLeftColor = '4px solid #16a34a';
                                            } else if (isPreviousRestored) {
                                                bgColor = '#ffedd5';
                                                borderLeftColor = '4px solid #ea580c';
                                            }

                                            return (
                                                <tr key={h.id_historial} style={{
                                                    backgroundColor: bgColor,
                                                    borderLeft: borderLeftColor,
                                                    transition: 'all 0.2s ease',
                                                    textDecoration: (isCurrent || isPreviousRestored) ? 'underline' : 'none'
                                                }}>
                                                    <td style={{ fontWeight: 700, color: isCurrent ? '#16a34a' : (isPreviousRestored ? '#ea580c' : '#2563eb') }}>
                                                        {h.version || '---'}
                                                        {isCurrent && (
                                                            <span style={{ marginLeft: '0.4rem', fontSize: '0.6rem', background: '#16a34a', color: 'white', padding: '1px 3px', borderRadius: '3px', verticalAlign: 'middle', textDecoration: 'none' }}>ACTIVA</span>
                                                        )}
                                                        {isPreviousRestored && (
                                                            <span style={{ marginLeft: '0.4rem', fontSize: '0.6rem', background: '#ea580c', color: 'white', padding: '1px 3px', borderRadius: '3px', verticalAlign: 'middle', textDecoration: 'none' }}>ANTERIOR</span>
                                                        )}
                                                    </td>
                                                    <td style={{ fontSize: '0.75rem' }}>{new Date(h.fecha_cambio).toLocaleString()}</td>
                                                    <td>{h.nombre_usuario_cambio || 'Sistema'}</td>
                                                    <td>{h.codigo}</td>
                                                    <td>{h.nombre}</td>
                                                    <td>{h.ubicacion}</td>
                                                    <td>
                                                        {!isCurrent ? (
                                                            <button
                                                                type="button"
                                                                className="btn-primary"
                                                                disabled={loading}
                                                                style={{
                                                                    padding: '0.3rem 0.6rem',
                                                                    fontSize: '0.75rem',
                                                                    background: '#2563eb',
                                                                    border: 'none',
                                                                    color: 'white',
                                                                    borderRadius: '4px',
                                                                    opacity: loading ? 0.6 : 1,
                                                                    cursor: loading ? 'not-allowed' : 'pointer',
                                                                    textDecoration: 'none'
                                                                }}
                                                                onClick={() => handleRestore(h)}
                                                            >
                                                                Habilitar
                                                            </button>
                                                        ) : (
                                                            <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, textDecoration: 'none' }}>Actual</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {initialData?.id_equipo && (
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem', fontStyle: 'italic' }}>
                        * El historial muestra las versiones anteriores. Al "Habilitar" una, el estado actual se guardará automáticamente en el historial.
                    </p>
                )}
                {/* Group 1: Clasificación y Estado */}
                <div className="form-section section-classification">
                    <h4 className="section-title">Clasificación y Estado</h4>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Tipo <span style={{ color: '#ef4444' }}>*</span></label>
                            <HybridSelect
                                label=""
                                name="tipo"
                                value={formData.tipo || ''}
                                options={tipoOptions.length > 0 ? tipoOptions : ['Analizador', 'Balanza', 'Cámara Fotográfica', 'Centrífuga', 'GPS', 'Instrumento', 'Medidor', 'Multiparámetro', 'Phmetro', 'Sonda']}
                                onChange={(val) => handleChange({ target: { name: 'tipo', value: val } } as any)}
                                disabled={!!initialData?.id_equipo}
                                placeholder="Seleccione Tipo..."
                                strict={true}
                                required
                                style={{
                                    border: (attemptedSubmit && !formData.tipo) ? '1.5px solid #ef4444' : undefined,
                                    borderRadius: (attemptedSubmit && !formData.tipo) ? '0.375rem' : undefined
                                }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Ubicación (Sede) <span style={{ color: '#ef4444' }}>*</span></label>
                            <HybridSelect
                                label=""
                                name="ubicacion"
                                value={formData.ubicacion || ''}
                                options={sedeOptions.length > 0 ? sedeOptions : ['PM', 'AY', 'VI', 'PA', 'PV', 'CH']}
                                onChange={(val) => handleChange({ target: { name: 'ubicacion', value: val } } as any)}
                                placeholder="Seleccione Ubicación..."
                                strict={true}
                                required
                                style={{
                                    border: (attemptedSubmit && !formData.ubicacion) ? '1.5px solid #ef4444' : undefined,
                                    borderRadius: (attemptedSubmit && !formData.ubicacion) ? '0.375rem' : undefined
                                }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Estado <span style={{ color: '#ef4444' }}>*</span></label>
                            <HybridSelect
                                label=""
                                name="estado"
                                value={formData.estado || ''}
                                options={estadoOptions.length > 0 ? estadoOptions : ['Activo', 'Inactivo']}
                                onChange={(val) => handleChange({ target: { name: 'estado', value: val } } as any)}
                                placeholder="Seleccione Estado..."
                                strict={true}
                                required
                                style={{
                                    border: (attemptedSubmit && !formData.estado) ? '1.5px solid #ef4444' : undefined,
                                    borderRadius: (attemptedSubmit && !formData.estado) ? '0.375rem' : undefined
                                }}
                            />
                        </div>

                    </div>
                </div>

                {/* Group 2: Datos Principales */}
                <div className="form-section section-main-data">
                    <h4 className="section-title">Datos Principales</h4>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Nombre <span style={{ color: '#ef4444' }}>*</span></label>
                            <HybridSelect
                                label=""
                                name="nombre"
                                value={formData.nombre || ''}
                                options={namesOptions}
                                disabled={!!(initialData?.requestId && initialData?.id_equipo)}
                                onChange={(val) => {
                                    const newSigla = nameToSigla[val] || formData.sigla;
                                    handleChange({ target: { name: 'nombre', value: val } } as any);
                                    if (nameToSigla[val]) {
                                        handleChange({ target: { name: 'sigla', value: newSigla } } as any);
                                    }
                                }}
                                placeholder="Seleccione..."
                                strict={true}
                                required
                                style={{
                                    border: (attemptedSubmit && !formData.nombre) ? '1.5px solid #ef4444' : undefined,
                                    borderRadius: (attemptedSubmit && !formData.nombre) ? '0.375rem' : undefined
                                }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Código <span style={{ color: '#ef4444' }}>*</span></span>
                                {generatingCode && <span style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 600 }}>Generando...</span>}
                            </label>
                            <input
                                type="text"
                                name="codigo"
                                value={formData.codigo || ''}
                                onChange={handleChange}
                                className="form-input"
                                style={{
                                    backgroundColor: (generatingCode || formData.codigo) ? '#f8fafc' : 'white',
                                    cursor: generatingCode ? 'wait' : 'default',
                                    color: generatingCode ? '#94a3b8' : '#1e293b',
                                    fontWeight: formData.codigo ? 700 : 400,
                                    border: (attemptedSubmit && !formData.codigo) ? '1.5px solid #ef4444' : undefined
                                }}
                                placeholder={generatingCode ? "Generando..." : "Se generará automáticamente"}
                                readOnly
                                required
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Sigla</label>
                            <input
                                type="text"
                                name="sigla"
                                value={formData.sigla || ''}
                                onChange={handleChange}
                                className="form-input"
                                readOnly={true}
                                style={{ backgroundColor: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                            />


                        </div>
                        <div className="form-group">
                            <label className="form-label">Correlativo</label>
                            <input
                                type="number"
                                name="correlativo"
                                value={formData.correlativo || 0}
                                onChange={handleChange}
                                className="form-input"
                                style={{
                                    backgroundColor: '#f8fafc',
                                    fontWeight: 600,
                                    border: (attemptedSubmit && !formData.codigo) ? '1.5px solid #ef4444' : undefined
                                }}
                                required
                                readOnly
                            />
                        </div>
                    </div>
                </div>

                {/* Group 3: Parametrización */}
                <div className="form-section section-parametrization">
                    <h4 className="section-title">Parametrización</h4>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Expiración (Vigencia) <span style={{ color: '#ef4444' }}>*</span></label>
                            <input
                                type="date"
                                name="vigencia"
                                value={formData.vigencia || ''}
                                onChange={handleChange}
                                className="form-input"
                                style={{
                                    border: (attemptedSubmit && !formData.vigencia) ? '1.5px solid #ef4444' : undefined
                                }}
                                required
                                min={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Asignado a (Muestreador)</label>
                            <HybridSelect
                                label=""
                                name="id_muestreador"
                                value={muestreadores.find(m => String(m.id_muestreador) === String(formData.id_muestreador))?.nombre_muestreador || ''}
                                options={muestreadores.map(m => m.nombre_muestreador)}
                                onChange={(val) => {
                                    const matching = muestreadores.find(m => m.nombre_muestreador === val);
                                    handleChange({
                                        target: {
                                            name: 'id_muestreador',
                                            value: matching ? matching.id_muestreador : (val === '-- Sin Asignar --' ? '0' : val)
                                        }
                                    } as any);
                                }}
                                placeholder="Seleccione Muestreador..."
                                strict={true}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Equipo Asociado (ID)</label>
                            <input
                                type="text"
                                name="equipo_asociado"
                                value={formData.equipo_asociado || ''}
                                onChange={handleChange}
                                className="form-input"
                                placeholder="Seleccione o escriba ID..."
                                onFocus={() => {
                                    if (formData.equipo_asociado === 'No Aplica') {
                                        setFormData((prev: any) => ({ ...prev, equipo_asociado: '' }));
                                    }
                                }}
                                onBlur={() => {
                                    if (!formData.equipo_asociado || formData.equipo_asociado.toString().trim() === '') {
                                        setFormData((prev: any) => ({ ...prev, equipo_asociado: 'No Aplica' }));
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Group 4: Configuración */}
                <div className="form-section section-configuration">
                    <h4 className="section-title">Configuración</h4>
                    <div className="form-row checkbox-row">
                        <div className="form-check">
                            <input
                                type="checkbox"
                                id="tiene_fc"
                                checked={formData.tiene_fc === 'SI'}
                                onChange={handleCheckboxChange('tiene_fc')}
                                className="form-checkbox"
                            />
                            <label htmlFor="tiene_fc">Tiene FC</label>
                        </div>
                        <div className="form-check">
                            <input
                                type="checkbox"
                                id="visible_muestreador"
                                checked={formData.visible_muestreador === 'SI'}
                                onChange={handleCheckboxChange('visible_muestreador')}
                                className="form-checkbox"
                            />
                            <label htmlFor="visible_muestreador">Visible Muestreador</label>
                        </div>
                        <div className="form-check">
                            <input
                                type="checkbox"
                                id="informe"
                                checked={formData.informe === 'SI'}
                                onChange={handleCheckboxChange('informe')}
                                className="form-checkbox"
                            />
                            <label htmlFor="informe">Incluir en Informe</label>
                        </div>
                    </div>
                </div>

                {/* Group 5: Mediciones y Errores */}
                <div className="form-section section-measurements">
                    <h4 className="section-title">Mediciones y Errores</h4>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Qué Mide</label>
                            <HybridSelect
                                label=""
                                name="que_mide"
                                value={formData.que_mide || ''}
                                options={queMideOptions.length > 0 ? queMideOptions : ['pH', 'Conductividad', 'Temperatura', 'Oxígeno Disuelto', 'Turbiedad', 'Salinidad', 'Presión Atmosférica', 'Humedad Relativa', 'Nivel Freático']}
                                onChange={(val) => handleChange({ target: { name: 'que_mide', value: val } } as any)}
                                placeholder="Seleccione..."
                                strict={true}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Unidad de Medida (Textual)</label>
                            <HybridSelect
                                label=""
                                name="unidad_medida_textual"
                                value={formData.unidad_medida_textual || ''}
                                options={unidadesOptions.length > 0 ? unidadesOptions : ['pH', 'µS/cm', '°C', 'mg/L', 'UNT', '%', 'hPa', 'm', 'm.s.n.m.']}
                                onChange={(val) => handleChange({ target: { name: 'unidad_medida_textual', value: val } } as any)}
                                placeholder="Seleccione..."
                                strict={true}
                            />
                        </div>

                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Error 0</label>
                            <input
                                type="number"
                                name="error0"
                                value={formData.error0 || 0}
                                onChange={handleChange}
                                className="form-input"
                                step="any"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Error 15</label>
                            <input
                                type="number"
                                name="error15"
                                value={formData.error15 || 0}
                                onChange={handleChange}
                                className="form-input"
                                step="any"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Error 30</label>
                            <input
                                type="number"
                                name="error30"
                                value={formData.error30 || 0}
                                onChange={handleChange}
                                className="form-input"
                                step="any"
                            />
                        </div>
                    </div>
                </div>

                {/* Group 6: Observaciones */}
                <div className="form-section section-observations">
                    <h4 className="section-title">Observaciones</h4>
                    <div className="form-group">
                        <textarea
                            name="observacion"
                            value={formData.observacion || ''}
                            onChange={handleChange}
                            className="form-input"
                            rows={3}
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
                        Cancelar
                    </button>
                    {initialData?.requestId && (!initialData.id_equipo || initialData.id_equipo === 0) && (
                        <button
                            type="button"
                            onClick={() => setRejectingSolicitud({
                                id_solicitud: initialData.requestId,
                                tipo_solicitud: 'ALTA',
                                datos_json: initialData
                            })}
                            className="btn-danger"
                            disabled={loading}
                            style={{
                                backgroundColor: '#fee2e2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                marginRight: '0.5rem'
                            }}
                        >
                            Rechazar Solicitud
                        </button>
                    )}
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading || !isFormValid || !(initialData?.id_equipo ? canEditEquipo : canCreateEquipo)}
                        title={!(initialData?.id_equipo ? canEditEquipo : canCreateEquipo) ? "No tienes permisos para realizar esta acción" : ""}
                        style={{
                            opacity: (loading || !isFormValid || !(initialData?.id_equipo ? canEditEquipo : canCreateEquipo)) ? 0.6 : 1,
                            cursor: (loading || !isFormValid || !(initialData?.id_equipo ? canEditEquipo : canCreateEquipo)) ? 'not-allowed' : 'pointer',
                            backgroundColor: (loading || !isFormValid || !(initialData?.id_equipo ? canEditEquipo : canCreateEquipo)) ? '#94a3b8' : (matchingVersion ? '#3b82f6' : '#10b981'),
                            border: 'none'
                        }}
                    >
                        {loading ? 'Guardando...' : (initialData?.id_equipo ? 'Actualizar' : 'Guardar')}
                    </button>
                </div>
            </form>


            {/* Custom Save Confirmation Modal */}
            {
                showSaveConfirm && (
                    <div className="modal-overlay" style={{ zIndex: 10001 }}>
                        <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
                            <div className="modal-body" style={{ padding: '2rem' }}>
                                <div style={{
                                    width: '60px',
                                    height: '60px',
                                    backgroundColor: matchingVersion ? '#eff6ff' : '#ecfdf5',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 1.5rem auto',
                                    color: matchingVersion ? '#3b82f6' : '#10b981'
                                }}>
                                    {matchingVersion ? (
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    ) : (
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                    )}
                                </div>
                                <h3 style={{ marginBottom: '1rem', color: '#111827', fontSize: '1.25rem' }}>
                                    {matchingVersion ? `¿Habilitar Versión ${matchingVersion.version}?` : `¿${initialData ? 'Actualizar' : 'Guardar'} datos?`}
                                </h3>
                                <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                    {matchingVersion ? (
                                        <>
                                            Al habilitar la <strong>Versión {matchingVersion.version}</strong>, el estado actual del equipo se guardará automáticamente en el historial antes de restaurar los datos seleccionados.
                                        </>
                                    ) : (
                                        `¿Está seguro de que desea ${initialData ? 'actualizar los datos' : 'crear este nuevo equipo'} en el sistema?`
                                    )}
                                </p>
                            </div>
                            <div className="modal-footer" style={{ border: 'none', paddingTop: 0 }}>
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => setShowSaveConfirm(false)}
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={handleConfirmSave}
                                    style={{
                                        flex: 1,
                                        backgroundColor: matchingVersion ? '#3b82f6' : '#2563eb',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: 'none'
                                    }}
                                >
                                    {matchingVersion ? 'Habilitar' : 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Rejection Reason Modal */}
            {
                rejectingSolicitud && (
                    <div className="modal-overlay" style={{ zIndex: 11000 }}>
                        <div className="modal-content" style={{ maxWidth: '450px' }}>
                            <div className="modal-header">
                                <h3 className="modal-title">Motivo de Rechazo</h3>
                            </div>
                            <div className="modal-body" style={{ padding: '1.5rem' }}>
                                <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem' }}>
                                    Indique el motivo por el cual está rechazando esta solicitud de <strong>{rejectingSolicitud.tipo_solicitud}</strong> para el equipo {formData.nombre}.
                                </p>
                                <div className="form-group">
                                    <label className="form-label">Feedback / Observaciones <span style={{ color: '#dc2626' }}>*</span></label>
                                    <textarea
                                        className="form-input"
                                        style={{ height: '100px', resize: 'none' }}
                                        placeholder="Ej: Documentación incompleta, equipo no corresponde..."
                                        value={adminFeedback}
                                        onChange={(e) => setAdminFeedback(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-cancel" onClick={() => { setRejectingSolicitud(null); setAdminFeedback(''); }} disabled={processingAction}>Cancelar</button>
                                <button
                                    className="btn-danger"
                                    onClick={confirmReject}
                                    disabled={processingAction || !adminFeedback.trim()}
                                    style={{ opacity: !adminFeedback.trim() ? 0.6 : 1 }}
                                >
                                    {processingAction ? '...' : 'Confirmar Rechazo'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Loading Overlay */}
            {
                (processingAction || loading) && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 12000,
                        animation: 'fadeIn 0.3s ease'
                    }}>
                        <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        @keyframes pulse {
                            0%, 100% { opacity: 1; transform: scale(1); }
                            50% { opacity: 0.7; transform: scale(0.98); }
                        }
                    `}</style>
                        <div style={{
                            width: '50px',
                            height: '50px',
                            border: '4px solid #f3f3f3',
                            borderTop: '4px solid #2563eb',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            marginBottom: '1rem',
                            boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)'
                        }}></div>
                        <div style={{
                            fontWeight: 700,
                            color: '#1e40af',
                            fontSize: '1.1rem',
                            letterSpacing: '0.05em',
                            animation: 'pulse 1.5s ease-in-out infinite',
                            textTransform: 'uppercase'
                        }}>
                            {loading ? 'Guardando cambios...' : 'Procesando acción...'}
                        </div>
                    </div>
                )
            }
        </div >
    );
};
