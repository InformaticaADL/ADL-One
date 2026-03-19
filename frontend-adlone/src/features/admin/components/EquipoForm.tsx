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
    const [allEquipos, setAllEquipos] = useState<Equipo[]>([]);
    const [history, setHistory] = useState<EquipoHistorial[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [editingObsIdx, setEditingObsIdx] = useState<number | null>(null);
    const [editingObsText, setEditingObsText] = useState('');
    const [isRestoring, setIsRestoring] = useState(false);
    const [requestedChanges, setRequestedChanges] = useState<any>(null);
    const [generatingCode, setGeneratingCode] = useState(false);
    const [namesOptions, setNamesOptions] = useState<string[]>([]);
    const [tipoOptions, setTipoOptions] = useState<string[]>([]);

    const [queMideOptions, setQueMideOptions] = useState<string[]>([]);
    const [unidadesOptions, setUnidadesOptions] = useState<string[]>([]);
    const [sedeOptions, setSedeOptions] = useState<string[]>([]);
    const [estadoOptions, setEstadoOptions] = useState<string[]>([]);
    const [fullCatalogItems, setFullCatalogItems] = useState<any[]>([]);
    const [nameToMetadata, setNameToMetadata] = useState<Record<string, Partial<Equipo>>>({});
    const [rejectingSolicitud, setRejectingSolicitud] = useState<any>(null);
    const [adminFeedback, setAdminFeedback] = useState('');
    const [processingAction, setProcessingAction] = useState(false);
    const [attemptedSubmit, setAttemptedSubmit] = useState(false);
    const [lastRestoredVersion, setLastRestoredVersion] = useState<{ active: string, previous: string } | null>(null);
    const [step, setStep] = useState(1);
    const [bulkQuantity, setBulkQuantity] = useState(1);
    const [bulkItems, setBulkItems] = useState<any[]>([]);
    const { hideNotification } = useNavStore();



    const { showToast } = useToast();
    const { hasPermission } = useAuth();
    const isGCMan = hasPermission('GC_ACCESO') || hasPermission('GC_EQUIPOS');
    const isMAMan = hasPermission('AI_MA_SOLICITUDES') || hasPermission('MA_A_GEST_EQUIPO');
    const isSuper = hasPermission('AI_MA_ADMIN_ACCESO');

    // Granular AI Permissions
    const canCreateEquipo = hasPermission('AI_MA_CREAR_EQUIPO') || isSuper;
    const canEditEquipo = hasPermission('AI_MA_EDITAR_EQUIPO') || isSuper;

    const autoGenerateSigla = (text: string) => {
        if (!text) return '';
        return text.split(',')
            .map(part => part.trim()
                .replace(/^(Unid\. de |Unidades de |Grados |de |en )/i, '')
            )
            .filter(part => part.length > 0)
            .join('/');
    };

    // Update metadata map for ALL catalog items whenever fullCatalogItems changes
    useEffect(() => {
        if (fullCatalogItems.length > 0) {
            const newMap: Record<string, any> = {};
            fullCatalogItems.forEach(item => {
                if (item.nombre) {
                    newMap[item.nombre.trim()] = {
                        que_mide: item.que_mide,
                        unidad_medida_textual: item.unidad_medida_textual,
                        unidad_medida_sigla: item.unidad_medida_sigla,
                        tipo: item.tipo_equipo
                    };
                }
            });
            setNameToMetadata(newMap);
        }
    }, [fullCatalogItems]);

    // Filter names by current type
    useEffect(() => {
        if (fullCatalogItems.length > 0) {
            const filtered = fullCatalogItems
                .filter((n: any) => !formData.tipo || n.tipo_equipo === formData.tipo);
            
            setNamesOptions(filtered.map(n => n.nombre).sort());
        }
    }, [formData.tipo, fullCatalogItems]);

    useEffect(() => {
        const fetchMuestreadoresAndCatalogs = async () => {
            try {
                // Fetch muestreadores and all equipments for dropdown
                const [mRes, eRes, allERes] = await Promise.all([
                    adminService.getMuestreadores('', 'ACTIVOS'),
                    equipoService.getEquipos({ limit: 1 }), // Get catalogs from any request
                    equipoService.getEquipos({ limit: 2000 }) // Fetch all equipments for dropdown
                ]);

                setMuestreadores(mRes.data || []);
                setAllEquipos(allERes.data || []);
                console.log("TESTING: allERes.data length is", allERes.data?.length);
                console.log("TESTING: first item in allERes.data", allERes.data?.[0]);

                if (eRes.catalogs?.nombres) {
                    setFullCatalogItems(eRes.catalogs.nombres);
                }

                if (eRes.catalogs?.tipos) {
                    setTipoOptions(eRes.catalogs.tipos.filter((t: string) => t && t.trim().length > 0));
                }
                if (eRes.catalogs?.que_mide) {
                    setQueMideOptions(eRes.catalogs.que_mide.filter((t: string) => t && t.trim().length > 0));
                }
                if (eRes.catalogs?.unidades) {
                    setUnidadesOptions(eRes.catalogs.unidades.filter((t: string) => t && t.trim().length > 0));
                }
                if (eRes.catalogs?.sedes) {
                    setSedeOptions(eRes.catalogs.sedes.filter((t: string) => t && t.trim().length > 0));
                }
                if (eRes.catalogs?.estados) {
                    setEstadoOptions(eRes.catalogs.estados.filter((t: string) => t && t.trim().length > 0));
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
                                codigo: res.data.suggestedCode,
                                previousCode: res.data.previousCode,
                                previousStatus: res.data.previousStatus
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
        formData.observacion &&
        !generatingCode
    );

    const generateBulkItems = (quantity: number, baseData: any) => {
        const items = [];
        for (let i = 0; i < quantity; i++) {
            const nextCorr = baseData.correlativo + i;
            const formattedCorr = nextCorr < 10 ? `0${nextCorr}` : `${nextCorr}`;
            const code = `${baseData.sigla}.${formattedCorr}/MA.${baseData.ubicacion}`;

            items.push({
                ...baseData,
                correlativo: nextCorr,
                codigo: code,
                id: i // temporary id for react keys
            });
        }
        setBulkItems(items);
    };

    const handleNextStep = () => {
        setAttemptedSubmit(true);
        if (isFormValid) {
            generateBulkItems(bulkQuantity, formData);
            setStep(2);
            // Scroll to top
            const modalBody = document.querySelector('.admin-form'); // Or container
            if (modalBody) modalBody.scrollIntoView({ behavior: 'smooth' });
        } else {
            showToast({
                type: 'error',
                message: 'Por favor complete todos los campos obligatorios marcados en rojo',
                duration: 5000
            });
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!initialData?.id_equipo && step === 1) {
            handleNextStep();
        } else if (step === 2 || initialData?.id_equipo) {
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
        }
    };

    const handleConfirmSave = async () => {
        setLoading(true);
        setError('');
        setShowSaveConfirm(false);

        try {
            const hasValidIdInit = !!initialData?.id_equipo && String(initialData.id_equipo) !== '0' && initialData.id_equipo !== 0 && String(initialData.id_equipo) !== 'null';

            if (hasValidIdInit) {
                const dataToSend = {
                    ...formData,
                    equipo_asociado: formData.equipo_asociado === 'No Aplica' ? 0 : Number(formData.equipo_asociado)
                };
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
                if (step === 2) {
                    // Always use bulkItems in Step 2 to ensure edits in the table are saved
                    const processedBulk = bulkItems.map(item => ({
                        ...item,
                        equipo_asociado: item.equipo_asociado === 'No Aplica' ? 0 : Number(item.equipo_asociado)
                    }));
                    
                    if (processedBulk.length > 1) {
                        await equipoService.createEquiposBulk(processedBulk);
                    } else {
                        await equipoService.createEquipo(processedBulk[0]);
                    }
                } else {
                    // Fallback for single creation if for some reason step 1 is allowed to save directly
                    const dataToSend = {
                        ...formData,
                        equipo_asociado: formData.equipo_asociado === 'No Aplica' ? 0 : Number(formData.equipo_asociado)
                    };
                    await equipoService.createEquipo(dataToSend);
                }

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
                        : (bulkQuantity > 1 ? 'Equipos creados correctamente' : 'Equipo creado correctamente'),
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
                {step === 1 && (
                    <>
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
                                        options={tipoOptions}
                                        onChange={(val) => {
                                            handleChange({ target: { name: 'tipo', value: val } } as any);
                                            // Filter names by this type immediately
                                            setFormData((prev: any) => ({ ...prev, nombre: '' }));
                                        }}
                                        disabled={!!initialData?.id_equipo}
                                        placeholder="Seleccione Tipo..."
                                        strict={!isSuper}
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
                                        options={estadoOptions.length > 0 ? estadoOptions : ['Activo', 'Inactivo', 'Calibración', 'Mantenimiento', 'Baja']}
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

                        {/* Group 2: Identificación */}
                        <div className="form-section section-id">
                            <h4 className="section-title">Identificación</h4>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Nombre del Equipo <span style={{ color: '#ef4444' }}>*</span></label>
                                    <HybridSelect
                                        label=""
                                        name="nombre"
                                        value={formData.nombre || ''}
                                        options={namesOptions}
                                        onChange={(val) => {
                                            const metadata = nameToMetadata[val.trim()];
                                            handleChange({ target: { name: 'nombre', value: val } } as any);
                                            
                                            if (metadata) {
                                                console.log("AUTO-FILL: Applying metadata for", val, metadata);
                                                setFormData((prev: any) => ({
                                                    ...prev,
                                                    que_mide: metadata.que_mide || '',
                                                    unidad_medida_textual: metadata.unidad_medida_textual || '',
                                                    unidad_medida_sigla: metadata.unidad_medida_sigla || ''
                                                }));
                                            }
                                        }}
                                        placeholder="Seleccione nombre..."
                                        strict={!isSuper}
                                        required
                                        style={{
                                            border: (attemptedSubmit && !formData.nombre) ? '1.5px solid #ef4444' : undefined,
                                            borderRadius: (attemptedSubmit && !formData.nombre) ? '0.375rem' : undefined
                                        }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Sigla Sugerida {generatingCode && <span className="loader-mini"></span>}</label>
                                    <input
                                        type="text"
                                        name="sigla"
                                        value={formData.sigla || ''}
                                        onChange={handleChange}
                                        className="form-input"
                                        placeholder="Ej: BAL"
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
                                    />
                                </div>
                            </div>

                            <div className="form-row mt-4">
                                <div className="form-group" style={{ flex: '2' }}>
                                    <label className="form-label">Código Final <span style={{ color: '#ef4444' }}>*</span> {generatingCode && <span className="loader-mini"></span>}</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            type="text"
                                            name="codigo"
                                            value={formData.codigo || ''}
                                            onChange={handleChange}
                                            className="form-input"
                                            style={{
                                                fontWeight: 700,
                                                color: '#1e40af',
                                                background: '#f8fafc',
                                                border: (attemptedSubmit && !formData.codigo) ? '1.5px solid #ef4444' : undefined,
                                                borderRadius: (attemptedSubmit && !formData.codigo) ? '0.375rem' : undefined
                                            }}
                                            placeholder="Auto-generado..."
                                        />
                                    </div>
                                    {formData.previousCode && (
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            Anterior: <span style={{ fontWeight: 600 }}>{formData.previousCode}</span>
                                            {formData.previousStatus && (
                                                <span style={{
                                                    marginLeft: '4px',
                                                    fontSize: '0.65rem',
                                                    padding: '1px 4px',
                                                    borderRadius: '3px',
                                                    background: formData.previousStatus === 'Activo' ? '#dcfce7' : '#fee2e2',
                                                    color: formData.previousStatus === 'Activo' ? '#166534' : '#991b1b'
                                                }}>
                                                    {formData.previousStatus}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="form-group" style={{ flex: '1' }}>
                                    <label className="form-label">Vigencia <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input
                                        type="date"
                                        name="vigencia"
                                        value={formData.vigencia || ''}
                                        onChange={handleChange}
                                        className="form-input"
                                        required
                                        style={{
                                            border: (attemptedSubmit && !formData.vigencia) ? '1.5px solid #ef4444' : undefined,
                                            borderRadius: (attemptedSubmit && !formData.vigencia) ? '0.375rem' : undefined
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Group 3: Responsable y Asociación */}
                        <div className="form-section section-responsable">
                            <h4 className="section-title">Asignación y Relación</h4>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Responsable (Muestreador) <span style={{ color: '#ef4444' }}>*</span></label>
                                    <select
                                        name="id_muestreador"
                                        value={formData.id_muestreador || ''}
                                        onChange={handleChange}
                                        className="form-input"
                                        style={{
                                            border: (attemptedSubmit && !formData.id_muestreador) ? '1.5px solid #ef4444' : undefined,
                                            borderRadius: (attemptedSubmit && !formData.id_muestreador) ? '0.375rem' : undefined
                                        }}
                                    >
                                        <option value="">Seleccione Responsable...</option>
                                        {muestreadores.map(m => (
                                            <option key={m.id_muestreador} value={m.id_muestreador}>{m.nombre_muestreador}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Equipo Asociado</label>
                                    <HybridSelect
                                        label=""
                                        name="equipo_asociado"
                                        value={String(formData.equipo_asociado || 'No Aplica')}
                                        options={['No Aplica', ...allEquipos.map(e => String(e.id_equipo))]}
                                        onChange={(val) => handleChange({ target: { name: 'equipo_asociado', value: val } } as any)}
                                        placeholder="Ej: 154"
                                        strict={false}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Group 4: Configuración Técnica */}
                        <div className="form-section section-technical">
                            <h4 className="section-title">Configuración Técnica</h4>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">¿Qué Mide? <span style={{ color: '#ef4444' }}>*</span></label>
                                    <HybridSelect
                                        label=""
                                        name="que_mide"
                                        value={formData.que_mide || ''}
                                        options={queMideOptions}
                                        onChange={(val) => {
                                            handleChange({ target: { name: 'que_mide', value: val } } as any);
                                            // Suggest unit/sigla if we find a unique match in catalog for this "Qué Mide"
                                            const match = fullCatalogItems.find(item => item.que_mide === val);
                                            if (match) {
                                                setFormData((prev: any) => ({
                                                    ...prev,
                                                    unidad_medida_textual: match.unidad_medida_textual || prev.unidad_medida_textual || '',
                                                    unidad_medida_sigla: match.unidad_medida_sigla || prev.unidad_medida_sigla || ''
                                                }));
                                            }
                                        }}
                                        placeholder="Seleccione..."
                                        strict={!isSuper}
                                        required
                                        style={{
                                            border: (attemptedSubmit && !formData.que_mide) ? '1.5px solid #ef4444' : undefined,
                                            borderRadius: (attemptedSubmit && !formData.que_mide) ? '0.375rem' : undefined
                                        }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Unidad de Medida</label>
                                    <HybridSelect
                                        label=""
                                        name="unidad_medida_textual"
                                        value={formData.unidad_medida_textual || ''}
                                        options={unidadesOptions}
                                        onChange={(val) => {
                                            handleChange({ target: { name: 'unidad_medida_textual', value: val } } as any);
                                            // Auto-generate sigla if it's currently empty or was just selected from list
                                            const generated = autoGenerateSigla(val);
                                            if (generated) {
                                                setFormData((prev: any) => ({
                                                    ...prev,
                                                    unidad_medida_sigla: generated
                                                }));
                                            }
                                        }}
                                        placeholder="Seleccione..."
                                        strict={!isSuper}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Sigla Unidad</label>
                                    <input
                                        type="text"
                                        name="unidad_medida_sigla"
                                        value={formData.unidad_medida_sigla || ''}
                                        onChange={handleChange}
                                        className="form-input"
                                        placeholder="Ej: mg/L"
                                    />
                                </div>
                            </div>

                            <div className="form-row mt-4" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        id="tienefc"
                                        checked={formData.tiene_fc === 'SI' || formData.tiene_fc === 'S'}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, tiene_fc: e.target.checked ? 'SI' : 'NO' }))}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    <label htmlFor="tienefc" className="form-label" style={{ marginBottom: 0 }}>¿Tiene Factor de Corrección?</label>
                                </div>
                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        id="visible_muestreador"
                                        checked={formData.visible_muestreador === 'SI' || formData.visible_muestreador === 'S'}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, visible_muestreador: e.target.checked ? 'SI' : 'NO' }))}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    <label htmlFor="visible_muestreador" className="form-label" style={{ marginBottom: 0 }}>Visible para Muestreadores</label>
                                </div>
                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        id="informe"
                                        checked={formData.informe === 'SI' || formData.informe === 'S'}
                                        onChange={(e) => setFormData((prev: any) => ({ ...prev, informe: e.target.checked ? 'SI' : 'NO' }))}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    <label htmlFor="informe" className="form-label" style={{ marginBottom: 0 }}>Incluir en Informe</label>
                                </div>
                            </div>
                        </div>

                        {/* Group 5: Errores */}
                        <div className="form-section section-errors">
                            <h4 className="section-title">Incertidumbre / Errores</h4>
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
                            <h4 className="section-title">Observaciones <span style={{ color: '#ef4444' }}>*</span></h4>
                            <div className="form-group">
                                <textarea
                                    name="observacion"
                                    value={formData.observacion || ''}
                                    onChange={handleChange}
                                    className="form-input"
                                    rows={3}
                                    style={{
                                        border: (attemptedSubmit && !formData.observacion) ? '1.5px solid #ef4444' : undefined,
                                        borderRadius: (attemptedSubmit && !formData.observacion) ? '0.375rem' : undefined
                                    }}
                                />
                            </div>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <div className="bulk-creation-container" style={{ padding: '0', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '2rem', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ background: '#1e40af', padding: '1.25rem 1.5rem', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.1rem', fontWeight: 700 }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                                CONFIGURACIÓN DE CREACIÓN MASIVA
                            </h4>
                            <div className="bulk-badge" style={{ background: 'rgba(255,255,255,0.2)', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 600 }}>
                                Template: {formData.nombre} ({formData.tipo})
                            </div>
                        </div>

                        <div style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                <div className="form-group" style={{ maxWidth: '150px', marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem', color: '#64748b' }}>CANTIDAD A CREAR</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        value={bulkQuantity}
                                        onChange={(e) => {
                                            const val = Math.max(1, Math.min(50, parseInt(e.target.value) || 1));
                                            setBulkQuantity(val);
                                            generateBulkItems(val, formData);
                                        }}
                                        className="form-input"
                                        style={{ height: '38px', fontSize: '1rem', fontWeight: 700 }}
                                    />
                                </div>
                                <div style={{ flex: 1, display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {[
                                        { label: 'Ubicación', field: 'ubicacion', applyCode: true },
                                        { label: 'Estado', field: 'estado' },
                                        { label: 'Responsable', field: 'id_muestreador' },
                                        { label: 'Vigencia', field: 'vigencia' },
                                        { label: 'Errores', fields: ['error0', 'error15', 'error30'] },
                                        { label: 'Observación', field: 'observacion' }
                                    ].map((action, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => {
                                                const firstItem = bulkItems[0];
                                                const newItems = bulkItems.map(item => {
                                                    const updatedItem = { ...item };
                                                    if (action.fields) {
                                                        action.fields.forEach(f => { updatedItem[f] = firstItem[f]; });
                                                    } else if (action.field) {
                                                        updatedItem[action.field] = firstItem[action.field];
                                                        if (action.applyCode) {
                                                            const formattedCorr = item.correlativo < 10 ? `0${item.correlativo}` : `${item.correlativo}`;
                                                            updatedItem.codigo = `${item.sigla}.${formattedCorr}/MA.${firstItem[action.field]}`;
                                                        }
                                                    }
                                                    return updatedItem;
                                                });
                                                setBulkItems(newItems);
                                                showToast({ type: 'info', message: `${action.label} aplicada a todos`, duration: 2000 });
                                            }}
                                            style={{
                                                fontSize: '0.85rem',
                                                color: '#1e40af',
                                                background: 'white',
                                                border: '1px solid #bfdbfe',
                                                padding: '0 1rem',
                                                height: '38px',
                                                borderRadius: '8px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bulk-items-table-container" style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                <div style={{ 
                                    overflow: 'auto', 
                                    maxHeight: '320px', 
                                    border: '1px solid #e2e8f0', 
                                    borderRadius: '8px',
                                    marginBottom: '1rem'
                                }}>
                                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '1300px' }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                                        <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                            <th style={{ padding: '0.6rem 0.4rem', width: '30px', color: '#64748b', fontSize: '0.6rem', fontWeight: 800 }}>
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>#</div>
                                            </th>
                                            <th style={{ padding: '0.6rem 0.4rem', width: '150px', color: '#1e40af', fontSize: '0.65rem', fontWeight: 800 }}>
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>CÓDIGO</div>
                                            </th>
                                            <th style={{ padding: '0.6rem 0.4rem', width: '80px', color: '#64748b', fontSize: '0.65rem', fontWeight: 800 }}>
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>UBICACIÓN</div>
                                            </th>
                                            <th style={{ padding: '0.6rem 0.4rem', width: '100px', color: '#64748b', fontSize: '0.65rem', fontWeight: 800 }}>
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>ESTADO</div>
                                            </th>
                                            <th style={{ padding: '0.6rem 0.4rem', width: '150px', color: '#64748b', fontSize: '0.65rem', fontWeight: 800 }}>
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>RESPONSABLE</div>
                                            </th>
                                            <th style={{ padding: '0.6rem 0.4rem', width: '115px', color: '#64748b', fontSize: '0.65rem', fontWeight: 800 }}>
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>VIGENCIA</div>
                                            </th>
                                            <th style={{ padding: '0.6rem 0.4rem', width: '140px', color: '#64748b', fontSize: '0.65rem', fontWeight: 800 }}>
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>ERRORES (0|15|30)</div>
                                            </th>
                                            <th style={{ padding: '0.6rem 0.4rem', width: '100px', color: '#64748b', fontSize: '0.65rem', fontWeight: 800 }}>
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>OBSERVACIÓN</div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bulkItems.map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'transparent' : '#fafafa' }}>
                                                <td style={{ padding: '0.3rem 0.4rem', color: '#94a3b8', fontSize: '0.65rem', fontWeight: 600, verticalAlign: 'middle' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'center' }}>{idx + 1}</div>
                                                </td>
                                                <td style={{ padding: '0.3rem 0.4rem', fontWeight: 700, color: '#1e40af', fontSize: '0.75rem', verticalAlign: 'middle' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'center' }}>{item.codigo}</div>
                                                </td>
                                                <td style={{ padding: '0.3rem 0.4rem', verticalAlign: 'middle' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                        <HybridSelect
                                                            label=""
                                                            name={`bulk_ubic_${idx}`}
                                                            value={item.ubicacion}
                                                            options={sedeOptions.length > 0 ? sedeOptions : ['PM', 'AY', 'VI', 'PA', 'PV', 'CH']}
                                                            onChange={(val) => {
                                                                const newItems = [...bulkItems];
                                                                newItems[idx].ubicacion = val;
                                                                const formattedCorr = item.correlativo < 10 ? `0${item.correlativo}` : `${item.correlativo}`;
                                                                newItems[idx].codigo = `${item.sigla}.${formattedCorr}/MA.${val}`;
                                                                setBulkItems(newItems);
                                                            }}
                                                            strict={true}
                                                            placeholder="Sede..."
                                                            style={{ height: '32px', fontSize: '0.75rem', width: '70px', textAlign: 'center' }}
                                                            showArrow={false}
                                                        />
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.3rem 0.4rem', verticalAlign: 'middle' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                        <HybridSelect
                                                            label=""
                                                            name={`bulk_estado_${idx}`}
                                                            value={item.estado}
                                                            options={estadoOptions.length > 0 ? estadoOptions : ['Activo', 'Inactivo', 'Calibración', 'Mantenimiento', 'Baja']}
                                                            onChange={(val) => {
                                                                const newItems = [...bulkItems];
                                                                newItems[idx].estado = val;
                                                                setBulkItems(newItems);
                                                            }}
                                                            strict={true}
                                                            placeholder="Estado..."
                                                            style={{ height: '32px', fontSize: '0.75rem', width: '90px', textAlign: 'center' }}
                                                            showArrow={false}
                                                        />
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.3rem 0.4rem', verticalAlign: 'middle' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                        <select
                                                            className="form-input"
                                                            value={item.id_muestreador || ''}
                                                            onChange={(e) => {
                                                                const newItems = [...bulkItems];
                                                                newItems[idx].id_muestreador = e.target.value;
                                                                setBulkItems(newItems);
                                                            }}
                                                            style={{ height: '32px', fontSize: '0.7rem', padding: '0 0.4rem', width: '140px', appearance: 'none', textAlign: 'center' }}
                                                        >
                                                            <option value="">Seleccione...</option>
                                                            {muestreadores.map(m => (
                                                                <option key={m.id_muestreador} value={m.id_muestreador}>{m.nombre_muestreador}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.3rem 0.4rem', verticalAlign: 'middle' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                        <input
                                                            type="date"
                                                            className="form-input"
                                                            value={item.vigencia || ''}
                                                            onChange={(e) => {
                                                                const newItems = [...bulkItems];
                                                                newItems[idx].vigencia = e.target.value;
                                                                setBulkItems(newItems);
                                                            }}
                                                            style={{ height: '32px', fontSize: '0.7rem', padding: '0 0.4rem', width: '110px', textAlign: 'center' }}
                                                        />
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.3rem 0.4rem', verticalAlign: 'middle' }}>
                                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                        {['error0', 'error15', 'error30'].map(field => (
                                                            <input
                                                                key={field}
                                                                type="number"
                                                                step="any"
                                                                className="form-input"
                                                                value={item[field] || 0}
                                                                onChange={(e) => {
                                                                    const newItems = [...bulkItems];
                                                                    newItems[idx][field] = parseFloat(e.target.value) || 0;
                                                                    setBulkItems(newItems);
                                                                }}
                                                                style={{ height: '32px', padding: '0 4px', fontSize: '0.75rem', textAlign: 'center', width: '45px' }}
                                                            />
                                                        ))}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.3rem 0.4rem', verticalAlign: 'middle' }}>
                                                    <div
                                                        onClick={() => { setEditingObsIdx(idx); setEditingObsText(item.observacion || ''); }}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '6px',
                                                            padding: '0 0.6rem',
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            background: 'white',
                                                            fontSize: '0.7rem',
                                                            color: item.observacion ? '#334155' : '#94a3b8',
                                                            height: '32px',
                                                            width: '90px',
                                                            margin: '0 auto'
                                                        }}
                                                    >
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                        <span style={{
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            flex: 1
                                                        }}>
                                                            {item.observacion ? 'Ver' : 'Editar'}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="modal-footer">
                    {step === 2 && (
                        <button type="button" onClick={() => setStep(1)} className="btn-secondary" style={{ marginRight: 'auto' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}><path d="M19 12H5M12 19l-7-7 7-7"></path></svg>
                            Volver al Formulario
                        </button>
                    )}
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
                            border: 'none',
                            minWidth: '120px'
                        }}
                    >
                        {loading ? 'Guardando...' : (initialData?.id_equipo ? 'Actualizar' : (step === 1 ? 'Siguiente' : 'Guardar Todo'))}
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

            {/* Observation Edit Pop-up */}
            {editingObsIdx !== null && (
                <div className="modal-overlay" style={{ zIndex: 11000, background: 'rgba(0,0,0,0.6)' }}>
                    <div className="modal-content" style={{ maxWidth: '600px', width: '90%', borderRadius: '16px', overflow: 'hidden' }}>
                        <div style={{ background: '#1e40af', padding: '1.25rem 1.5rem', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                EDITAR OBSERVACIÓN (ITEM #{editingObsIdx + 1})
                            </h3>
                            <button
                                onClick={() => setEditingObsIdx(null)}
                                style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="modal-body" style={{ padding: '1.5rem' }}>
                            <div className="form-group">
                                <label className="form-label">DETALLE DE LA OBSERVACIÓN</label>
                                <textarea
                                    className="form-input"
                                    style={{ height: '200px', resize: 'vertical', fontSize: '0.95rem', lineHeight: '1.5', padding: '1rem' }}
                                    placeholder="Escriba aquí los detalles..."
                                    value={editingObsText}
                                    onChange={(e) => setEditingObsText(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="modal-footer" style={{ borderTop: '1px solid #f1f5f9', padding: '1rem 1.5rem' }}>
                            <button
                                className="btn-secondary"
                                onClick={() => setEditingObsIdx(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-primary"
                                onClick={() => {
                                    const newItems = [...bulkItems];
                                    newItems[editingObsIdx].observacion = editingObsText;
                                    setBulkItems(newItems);
                                    setEditingObsIdx(null);
                                    showToast({ type: 'success', message: 'Observación actualizada', duration: 1500 });
                                }}
                                style={{ background: '#1e40af', border: 'none' }}
                            >
                                Confirmar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
