import React, { useState, useRef, useTransition, useCallback, useEffect, useMemo } from 'react';
import { AntecedentesForm } from './AntecedentesForm';
import type { AntecedentesFormHandle } from './AntecedentesForm';
import { ParametrosVisitaForm, PrecioVisitaForm } from './AnalisisVisitaForm';
import { PasosLayout, type PasoInfo, type EstadoPaso } from './PasosLayout';
import type { FuenteAnalisis } from './AgregarParametrosDialog';
import { PuntosVisitaTable } from './PuntosVisitaTable';
import { ObservacionesForm } from './ObservacionesForm';
import { ResumenVisita } from './ResumenVisita';
import type { ObservacionesFormHandle } from './ObservacionesForm';
import { fichaService } from '../services/ficha.service';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import { facturacionService } from '../../facturacion/services/facturacion.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    ajustarParametrosPorCambioDePuntos,
    armarPayloadVisita,
    desdeFijoPorDefecto,
    desdeFilaGuardada,
    formatoUF,
    nuevoPunto,
    problemasDeParametros,
    problemasDePuntos,
    seEnvia,
    totalDeLaVisita,
    type ParametroVisita,
    type PuntoFila,
} from '../utils/analisisVisita';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
    IconCheck,
    IconFileText,
    IconEye,
    IconInfoCircle,
    IconMapPin,
} from '@tabler/icons-react';
import { useNavStore } from '../../../store/navStore';

// ─── Borrador de la visita ───────────────────────────────────────────────────────────────────────────
// Lo que se va completando se guarda en este navegador para retomarlo si se cierra la pestaña.
const claveBorrador = (idUsuario: unknown) => `adlone:borrador-visita-v2:${idUsuario ?? 0}`;

const leerBorrador = (clave: string): any => {
    try {
        const raw = localStorage.getItem(clave);
        if (!raw) return null;
        const d = JSON.parse(raw);
        if (d?.version !== 2) return null;
        return d;
    } catch { return null; }
};
const escribirBorrador = (clave: string, valor: unknown): boolean => {
    try { localStorage.setItem(clave, JSON.stringify(valor)); return true; } catch { return false; }
};
const borrarBorrador = (clave: string) => { try { localStorage.removeItem(clave); } catch { /* sin acceso al almacenamiento */ } };

// ─── Pasos ───────────────────────────────────────────────────────────────────────────────────────────
// Antecedentes: un paso por bloque del formulario. Las etiquetas son las que entrega AntecedentesForm en «missing».
type BloqueAnt = 'ident' | 'servicio' | 'clasif' | 'operativo';
const PASOS_ANT: Array<{ id: BloqueAnt; titulo: string; descripcion: string; subtitulo: string; ayuda: string }> = [
    { id: 'ident', titulo: 'Identificación', descripcion: 'Quién y dónde', subtitulo: 'Quién es el cliente y qué se muestrea.', ayuda: 'Elija el tipo de monitoreo, la empresa a facturar y la fuente emisora. Lo marcado con * es obligatorio.' },
    { id: 'servicio', titulo: 'Datos del servicio', descripcion: 'Objetivo y frecuencia', subtitulo: 'Objetivo, responsable y frecuencia del servicio.', ayuda: 'Indique para qué es el servicio y con qué frecuencia se repite.' },
    { id: 'clasif', titulo: 'Clasificación técnica', descripcion: 'Norma y componente', subtitulo: 'Instrumento legal, componente ambiental y glosa.', ayuda: 'Indique la norma que se aplica y el tipo de agua o lodo.' },
    { id: 'operativo', titulo: 'Detalles operativos', descripcion: 'Cómo se muestrea', subtitulo: 'Tipo de muestreo, de muestra y de descarga, y medición de caudal.', ayuda: 'Cómo se toma la muestra y si se mide el caudal. Si se mide, aparecen más campos.' },
];
const ETIQUETAS_BLOQUE: Record<BloqueAnt, string[]> = {
    ident: ['Tipo de Monitoreo', 'Lugar de Análisis', 'Cliente', 'Empresa de Servicio', 'Fuente Emisora', 'Contacto Empresa'],
    servicio: ['Objetivo del Muestreo', 'Responsable Muestreo', 'Cargo', 'Punto de Muestreo', 'Frecuencia Periodo', 'Cant. Frecuencia', 'Factor', 'Total Servicios'],
    clasif: ['Zona UTM', 'UTM Norte', 'UTM Este', 'Instrumento Legal', 'N° Instrumento', 'Año Instrumento', 'Componente Ambiental', 'Sub-Área', 'Glosa'],
    operativo: ['Tipo de Muestreo', 'Tipo de Muestra', 'Actividad', 'Duración', 'Tipo de Descarga', 'Medición de Caudal', 'Modalidad de Medición', 'Forma de Canal', 'Dispositivo Hidráulico', 'Tipo Medida Canal', 'Detalle Canal', 'Tipo Medida Dispositivo', 'Detalle Dispositivo'],
};
// Puntos y análisis.
const PASOS_VIS = [
    { id: 'puntos', titulo: 'Puntos', descripcion: 'Dónde se toma la muestra', subtitulo: 'Genere los nombres, péguelos desde Excel o agréguelos uno a uno.', ayuda: 'Escriba los nombres de los puntos y cuántas réplicas quiere. Cada punto queda registrado por separado dentro de la visita.' },
    { id: 'parametros', titulo: 'Parámetros', descripcion: 'Qué se mide y en qué laboratorio', subtitulo: 'Los de terreno se miden en el lugar. Los de laboratorio llevan entrega y laboratorio.', ayuda: 'Elija un punto y agregue sus parámetros. Aquí no hay precios todavía.' },
    { id: 'precio', titulo: 'Precio', descripcion: 'Tarifa por parámetro', subtitulo: 'Una tarifa por parámetro y punto, más el costo operativo de la visita.', ayuda: 'Parta de un valor repartido o escriba cada tarifa. El valor del punto y el total siempre son la suma.' },
    { id: 'observaciones', titulo: 'Observaciones', descripcion: 'Resumen y crear', subtitulo: 'Instrucciones comerciales y resumen de la visita.', ayuda: 'Revise el resumen y escriba las instrucciones comerciales. Al crear se registra la visita completa.' },
];

const zonaNoAplica = (zona: string) => /^\s*(no\s*aplica|n\/?a)\s*$/i.test(zona || '');

const SuccessModal = ({
    isOpen,
    onClose,
    onViewFicha,
    fichaId,
    cantidad = 1
}: {
    isOpen: boolean;
    onClose: () => void;
    onViewFicha: () => void;
    fichaId: number | null;
    cantidad?: number;
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>{cantidad > 1 ? '¡Visita creada exitosamente!' : '¡Ficha creada exitosamente!'}</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col items-center gap-3 py-6">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 text-success">
                        <IconCheck size={40} />
                    </div>

                    <h4 className="m-0 text-center text-base font-semibold text-foreground">Registro Confirmado</h4>

                    <p className="text-center text-sm text-muted-foreground">
                        {cantidad > 1
                            ? <>Se registró la visita con <span className="font-semibold text-primary">{cantidad} puntos</span>. El primero quedó con el N° <span className="font-semibold text-primary">{fichaId}</span>.</>
                            : <>Se ha generado la Ficha N° <span className="font-semibold text-primary">{fichaId}</span> correctamente en el sistema.</>}
                    </p>

                    <div className="mt-4 flex w-full gap-3">
                        <Button variant="outline" size="lg" className="flex-1" onClick={onViewFicha}>
                            <IconEye size={18} /> Ver Ficha
                        </Button>
                        <Button size="lg" className="flex-1" onClick={onClose}>
                            Volver al Menú
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export const FichaCreateForm = ({ onBackToMenu, onSuccess }: { onBackToMenu: () => void; onSuccess?: () => void }) => {
    const isMobile = useMediaQuery('(max-width: 550px)');
    const isVerySmall = useMediaQuery('(max-width: 450px)');
    const { user } = useAuth();
    const { showToast } = useToast();
    const catalogos = useCachedCatalogos();
    const { setSelectedFicha, setFichasMode, cotizacionParaFicha, setCotizacionParaFicha } = useNavStore();
    // Ficha que nace de una cotización aceptada: llega con cliente, centro y los
    // análisis con el precio que el cliente ya aprobó. AntecedentesForm decide si
    // hidrata al montarse, así que no se renderiza hasta tener la precarga.
    const [prefillCotizacion, setPrefillCotizacion] = useState<any>(null);
    const [cargandoCotizacion, setCargandoCotizacion] = useState<boolean>(!!cotizacionParaFicha);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [createdFichaId, setCreatedFichaId] = useState<number | null>(null);
    const [createdCount, setCreatedCount] = useState<number>(1);
    const [isAntecedentesValid, setIsAntecedentesValid] = useState(false);
    const [isObservacionesValid, setIsObservacionesValid] = useState(false);
    // Observaciones: por defecto «Sin observaciones»; solo si se elige «Añadir observación» aparece el cuadro de texto.
    const [conObs, setConObs] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState<string>('antecedentes');
    // Paso actual y el más lejano visitado en cada pestaña; «faltantes» son los campos obligatorios que aún no se completan.
    const [pasoAnt, setPasoAnt] = useState(0);
    const [maxAnt, setMaxAnt] = useState(0);
    const [pasoVis, setPasoVis] = useState(0);
    const [maxVis, setMaxVis] = useState(0);
    const [faltantes, setFaltantes] = useState<string[]>([]);
    const antecedentesRef = useRef<AntecedentesFormHandle>(null);
    const observacionesRef = useRef<ObservacionesFormHandle>(null);
    const topRef = useRef<HTMLDivElement>(null);

    // La visita: puntos (una ficha cada uno), parámetros (en qué puntos se miden y a qué precio) y costo operativo (centésimas de UF).
    const [puntos, setPuntos] = useState<PuntoFila[]>(() => [nuevoPunto()]);
    const [parametros, setParametros] = useState<ParametroVisita[]>([]);
    const [costoOperativo, setCostoOperativo] = useState<number>(0);
    const puntosRef = useRef<PuntoFila[]>(puntos);
    puntosRef.current = puntos;

    const [datosIniciales, setDatosIniciales] = useState<any>(null);
    const [formKey, setFormKey] = useState(0);
    const [obsInicial, setObsInicial] = useState('');
    const [obsKey, setObsKey] = useState(0);
    const claveBorr = claveBorrador(user?.id);
    const [borradorPendiente, setBorradorPendiente] = useState<any>(() => (cotizacionParaFicha ? null : leerBorrador(claveBorrador(user?.id))));

    // Catálogos de laboratorios, tipos de entrega y zonas UTM.
    const [laboratorios, setLaboratorios] = useState<any[]>([]);
    const [tiposEntrega, setTiposEntrega] = useState<any[]>([]);
    const [zonas, setZonas] = useState<Array<{ value: string; label: string }>>([]);
    useEffect(() => {
        catalogos.getLaboratorios().then((l) => setLaboratorios(l || [])).catch(() => showToast({ type: 'error', message: 'Error al cargar laboratorios' }));
        catalogos.getTiposEntrega().then((t) => setTiposEntrega(t || [])).catch(() => showToast({ type: 'error', message: 'Error al cargar tipos de entrega' }));
        catalogos.getZonasUTM().then((z) => setZonas((z || []).map((x: any) => ({ value: x.nombre_zonautm, label: x.nombre_zonautm })))).catch(() => { /* sin zonas no se puede elegir */ });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fuente = useMemo<FuenteAnalisis>(() => ({
        getNormativas: () => catalogos.getNormativas(),
        getReferencias: (id) => catalogos.getReferenciasByNormativa(id),
        getAnalisis: (n, r) => catalogos.getAnalysisByNormativaReferencia(n, r),
        laboratorios,
        tiposEntrega,
    }), [laboratorios, tiposEntrega]); // eslint-disable-line react-hooks/exhaustive-deps

    // Estado de partida: pH y Temperatura (terreno) vienen pre-agregados, sin normativa/tabla hasta que el usuario la elija.
    // Si no se configuran no se envían. Se cargan una sola vez al montar.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const defaults = await fichaService.getDefaultAnalyses();
                if (cancelled || !defaults || defaults.length === 0) return;
                setParametros((prev) => {
                    if (prev.length > 0) return prev; // no pisar si el usuario ya agregó algo
                    const ids = puntosRef.current.map((p) => p.id);
                    return defaults.map((d: any) => desdeFijoPorDefecto(d, ids));
                });
            } catch {
                /* si falla, la ficha simplemente arranca sin los fijos */
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Precarga desde la cotización. Los análisis cotizados se AGREGAN a los fijos (pH/Temperatura), no los reemplazan.
    useEffect(() => {
        if (!cotizacionParaFicha) return;
        let cancelled = false;
        (async () => {
            try {
                const prep = await facturacionService.getCotizacionParaFicha(cotizacionParaFicha);
                if (cancelled) return;
                setPrefillCotizacion(prep);
                const a = prep.antecedentes;
                if (a && (a.puntoMuestreo || a.zona)) {
                    setPuntos([nuevoPunto({ puntoMuestreo: a.puntoMuestreo || '', zona: a.zona || '', utmNorte: a.utmNorte || '', utmEste: a.utmEste || '', refGoogle: a.refGoogle || '' })]);
                }
                if (prep.analisis?.length) {
                    setParametros((prev) => {
                        const ids = puntosRef.current.map((p) => p.id);
                        return [...prev, ...prep.analisis.map((x: any) => desdeFilaGuardada({ ...x, tipo_analisis: 'Laboratorio' }, ids))];
                    });
                }
            } catch {
                if (!cancelled) {
                    showToast({ type: 'error', message: 'No se pudo cargar la cotización: complete la ficha a mano.' });
                }
            } finally {
                if (!cancelled) setCargandoCotizacion(false);
            }
        })();
        return () => { cancelled = true; };
    }, [cotizacionParaFicha, showToast]);

    const handleValidationChange = useCallback((isValid: boolean, missing?: string[]) => {
        startTransition(() => {
            setIsAntecedentesValid(isValid);
            setFaltantes(missing || []);
        });
    }, [startTransition]);

    const handleObsValidationChange = useCallback((isValid: boolean) => {
        startTransition(() => {
            setIsObservacionesValid(isValid);
        });
    }, [startTransition]);

    const scrollToTop = () => {
        if (topRef.current) {
            topRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
    };

    // ─── Puntos: al agregar o quitar filas, los parámetros se ajustan solos ─────────────────────────────
    // Un punto nuevo parte con los parámetros y precios del punto anterior; al quitar uno se olvidan sus datos.
    const cambiarPuntos = (nuevos: PuntoFila[]) => {
        const antes = puntosRef.current.map((p) => p.id);
        setParametros((prev) => ajustarParametrosPorCambioDePuntos(prev, antes, nuevos.map((p) => p.id)));
        setPuntos(nuevos);
    };

    // ─── Validaciones ───────────────────────────────────────────────────────────────────────────────────
    const problemasPuntos = useMemo(() => problemasDePuntos(puntos, zonaNoAplica), [puntos]);
    const problemasParametros = useMemo(
        () => problemasDeParametros(parametros, puntos.map((p) => ({ id: p.id, nombre: p.puntoMuestreo.trim() }))),
        [parametros, puntos],
    );
    const puntosOk = problemasPuntos.length === 0;
    const parametrosOk = problemasParametros.length === 0;
    const hayParametros = parametros.some(seEnvia);

    // ─── Guardar ────────────────────────────────────────────────────────────────────────────────────────
    const resolvedor = useMemo(() => ({
        nombreLaboratorio: (id: number) => String(laboratorios.find((l) => Number(l.id_laboratorioensayo) === id)?.nombre_laboratorioensayo || ''),
        nombreTipoEntrega: (id: number) => String(tiposEntrega.find((t) => Number(t.id_tipoentrega) === id)?.nombre_tipoentrega || ''),
    }), [laboratorios, tiposEntrega]);

    // Datos comunes a toda la visita: observaciones comerciales, usuario y cotización de origen.
    const datosDeLaVisita = () => ({
        observaciones: (conObs ? observacionesRef.current?.getData() : '') || 'No Aplica',
        user: { id: user?.id || 0 },
        // Trazabilidad cotización → ficha → casos → pre-factura.
        idCotizacion: cotizacionParaFicha || null,
    });

    const handleSave = async () => {
        if (isSaving) return;
        const antData = antecedentesRef.current?.getData ? antecedentesRef.current.getData() : null;
        if (!antData || !isAntecedentesValid) {
            setActiveTab('antecedentes');
            const i = PASOS_ANT.findIndex((p) => faltantes.some((l) => ETIQUETAS_BLOQUE[p.id].includes(l)));
            if (i >= 0) { setPasoAnt(i); setMaxAnt((m) => Math.max(m, i)); }
            showToast({ type: 'warning', message: 'Por favor complete los antecedentes requeridos' });
            return;
        }
        if (!puntosOk || !parametrosOk || !hayParametros) {
            showToast({ type: 'warning', message: (problemasPuntos[0] || problemasParametros[0] || 'Agregue al menos un parámetro.') });
            return;
        }
        if (conObs && !isObservacionesValid) {
            showToast({ type: 'warning', message: 'Escriba la observación o elija «Sin observaciones».' });
            return;
        }
        const { payload, esGrupo } = armarPayloadVisita({
            antecedentes: antData,
            puntos,
            parametros,
            costoOperativo,
            resolvedor,
            comunes: datosDeLaVisita(),
        });
        await enviarVisita(payload, esGrupo);
    };

    // Crea la ficha (un punto) o la visita completa (varios puntos agrupados) y muestra el resultado.
    const enviarVisita = async (payload: Record<string, unknown>, esGrupo: boolean) => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const result = esGrupo ? await fichaService.createGrupo(payload) : await fichaService.create(payload);

            if (result && (result.success || result.data?.success)) {
                borrarBorrador(claveBorr);
                const idToUse = result.data?.id_fichaingresoservicio || result.data?.id || result.id;
                if (idToUse) {
                    if (cotizacionParaFicha) {
                        // Deja la cotización marcada como ya convertida en trabajo.
                        // Si esto falla, la ficha ya quedó creada: no se revierte.
                        facturacionService.marcarCotizacionConvertida(cotizacionParaFicha).catch(() => { });
                        setCotizacionParaFicha(null);
                    }
                    setCreatedFichaId(Number(idToUse));
                    setCreatedCount(Array.isArray(result.data?.ids) ? result.data.ids.length : 1);
                    setShowSuccessModal(true);
                } else {
                    showToast({ type: 'warning', message: 'Ficha creada pero no se recibió un ID válido.' });
                }
            } else {
                showToast({ type: 'error', message: 'Error en la respuesta del servidor' });
            }

        } catch (error: any) {
            console.error("Error saving ficha:", error);
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al grabar la ficha' });
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Borrador ───────────────────────────────────────────────────────────────────────────────────────
    const estadoRef = useRef<any>(null);
    estadoRef.current = { puntos, parametros, costoOperativo, activeTab, pasoAnt, pasoVis, conObs };

    const guardarBorradorAhora = useCallback((): boolean => {
        const e = estadoRef.current;
        if (!e || cargandoCotizacion) return true;
        const ant = antecedentesRef.current?.getData?.();
        const hayAntecedentes = !!(ant && (ant.selectedCliente || ant.selectedFuente || ant.selectedObjetivo));
        const hayPuntos = e.puntos.some((p: PuntoFila) => p.puntoMuestreo.trim() || p.zona || p.utmNorte.trim() || p.utmEste.trim());
        const hayParametros = e.parametros.some((p: ParametroVisita) => !p.fijo || p.base.id_referenciaanalisis != null);
        if (!hayAntecedentes && !hayPuntos && !hayParametros) return true;
        return escribirBorrador(claveBorr, {
            version: 2,
            guardadoEn: Date.now(),
            antecedentes: ant || null,
            puntos: e.puntos,
            parametros: e.parametros,
            costoOperativo: e.costoOperativo,
            observaciones: e.conObs ? (observacionesRef.current?.getData() || '') : '',
            pestana: e.activeTab,
            pasoAnt: e.pasoAnt,
            pasoVis: e.pasoVis,
        });
    }, [claveBorr, cargandoCotizacion]);

    useEffect(() => {
        let avisado = false;
        const guardar = () => {
            if (!guardarBorradorAhora() && !avisado) {
                avisado = true;
                showToast({ type: 'warning', message: 'No se pudo guardar el borrador en este navegador. Termine la visita antes de salir.' });
            }
        };
        const t = setInterval(guardar, 4000);
        window.addEventListener('beforeunload', guardar);
        return () => { clearInterval(t); window.removeEventListener('beforeunload', guardar); };
    }, [guardarBorradorAhora, showToast]);

    const handleSalir = () => {
        guardarBorradorAhora();
        onBackToMenu();
    };

    const handleDescartarBorrador = () => {
        borrarBorrador(claveBorr);
        setBorradorPendiente(null);
        const primero = nuevoPunto();
        setPuntos([primero]);
        puntosRef.current = [primero];
        setCostoOperativo(0);
        setDatosIniciales(null);
        setFormKey(k => k + 1);
        setObsInicial('');
        setConObs(false);
        setObsKey(k => k + 1);
        setActiveTab('antecedentes');
        setPasoAnt(0); setMaxAnt(0); setPasoVis(0); setMaxVis(0);
        setParametros([]);
        // Vuelve a los análisis fijos de partida (pH + Temperatura), igual que al abrir la pantalla.
        fichaService.getDefaultAnalyses().then((defaults: any[]) => {
            if (!defaults || defaults.length === 0) return;
            setParametros((prev) => (prev.length > 0 ? prev : defaults.map((d: any) => desdeFijoPorDefecto(d, [primero.id]))));
        }).catch(() => { /* la ficha arranca sin los fijos */ });
    };

    const handleContinuarBorrador = () => {
        const d = borradorPendiente;
        if (!d) return;
        setBorradorPendiente(null);
        const pts: PuntoFila[] = Array.isArray(d.puntos) && d.puntos.length > 0 ? d.puntos : [nuevoPunto()];
        setPuntos(pts);
        puntosRef.current = pts;
        setParametros(Array.isArray(d.parametros) ? d.parametros : []);
        setCostoOperativo(Number(d.costoOperativo) || 0);
        setObsInicial(d.observaciones || '');
        setConObs(!!String(d.observaciones || '').trim());
        setObsKey(k => k + 1);
        if (d.antecedentes) { setDatosIniciales(d.antecedentes); setFormKey(k => k + 1); }
        // Borradores de la versión con cuatro pestañas: puntos / analisis / observaciones pasan a «Puntos y análisis».
        const viejo: Record<string, number> = { puntos: 0, analisis: 1, observaciones: 3 };
        if (d.pestana === 'visita' || d.pestana in viejo) {
            const pv = d.pestana === 'visita' ? Math.min(3, Math.max(0, Number(d.pasoVis) || 0)) : viejo[d.pestana];
            setActiveTab('visita'); setPasoVis(pv); setMaxVis(3);
            setPasoAnt(PASOS_ANT.length - 1); setMaxAnt(PASOS_ANT.length - 1);
        } else {
            const pa = Math.min(PASOS_ANT.length - 1, Math.max(0, Number(d.pasoAnt) || 0));
            setActiveTab('antecedentes'); setPasoAnt(pa); setMaxAnt(pa);
        }
    };

    const handleCloseSuccess = () => {
        setShowSuccessModal(false);
        setCreatedFichaId(null);
        // F-01a: tras crear, ir al listado de fichas en lugar del selector
        if (onSuccess) {
            onSuccess();
        } else {
            onBackToMenu();
        }
    };

    const handleViewFicha = () => {
        if (createdFichaId) {
            setSelectedFicha(createdFichaId, null);
            setFichasMode('detail_ficha');
        }
        setShowSuccessModal(false);
    };

    // ─── Pasos: estado de cada uno y navegación ─────────────────────────────────────────────────────────
    const faltanDe = (id: BloqueAnt) => faltantes.filter((l) => ETIQUETAS_BLOQUE[id].includes(l));

    const pasosAnt: PasoInfo[] = PASOS_ANT.map((p, i) => {
        const f = faltanDe(p.id).length;
        const estado: EstadoPaso = i === pasoAnt ? 'actual' : i <= maxAnt ? (f > 0 ? 'error' : 'completo') : 'pendiente';
        return { id: p.id, titulo: p.titulo, descripcion: p.descripcion, estado, aviso: f > 0 ? `Faltan ${f} ${f > 1 ? 'campos' : 'campo'}` : undefined, bloqueado: i > maxAnt };
    });

    // Problema de cada paso de «Puntos y análisis» (null = en orden).
    const problemaVis: Array<string | null> = [
        problemasPuntos[0] ?? null,
        !hayParametros ? 'Agregue al menos un parámetro.' : (problemasParametros[0] ?? null),
        null,
        conObs && !isObservacionesValid ? 'Escriba la observación o elija «Sin observaciones».' : null,
    ];
    const pasosVis: PasoInfo[] = PASOS_VIS.map((p, i) => {
        const estado: EstadoPaso = i === pasoVis ? 'actual' : i <= maxVis ? (problemaVis[i] ? 'error' : 'completo') : 'pendiente';
        return { id: p.id, titulo: p.titulo, descripcion: p.descripcion, estado, aviso: problemaVis[i] || undefined, bloqueado: i > maxVis };
    });

    const irAnt = (i: number) => { setPasoAnt(i); setMaxAnt((m) => Math.max(m, i)); scrollToTop(); };
    const irVis = (i: number) => { setPasoVis(i); setMaxVis((m) => Math.max(m, i)); scrollToTop(); };
    const avisar = (message: string) => showToast({ id: 'ficha-paso-guard', type: 'warning', message });

    const siguienteAnt = () => {
        const f = faltanDe(PASOS_ANT[pasoAnt].id);
        if (f.length > 0) { avisar(`Falta: ${f.slice(0, 3).join(', ')}${f.length > 3 ? ` y ${f.length - 3} más` : ''}.`); return; }
        if (pasoAnt < PASOS_ANT.length - 1) { irAnt(pasoAnt + 1); return; }
        if (!isAntecedentesValid) { avisar('Complete primero los antecedentes obligatorios.'); return; }
        setActiveTab('visita');
        scrollToTop();
    };
    const siguienteVis = () => {
        const problema = problemaVis[pasoVis];
        if (problema) { avisar(problema); return; }
        if (pasoVis < PASOS_VIS.length - 1) { irVis(pasoVis + 1); return; }
        handleSave();
    };
    const atrasAnt = pasoAnt > 0 ? () => irAnt(pasoAnt - 1) : undefined;
    const atrasVis = () => {
        if (pasoVis > 0) { irVis(pasoVis - 1); return; }
        setActiveTab('antecedentes');
        irAnt(PASOS_ANT.length - 1);
    };
    const borradorManual = () => {
        if (guardarBorradorAhora()) showToast({ type: 'success', message: 'Borrador guardado. Puede cerrar y seguir después.' });
        else showToast({ type: 'warning', message: 'No se pudo guardar el borrador en este navegador.' });
    };

    const handleTabChange = (val: string) => {
        // Antecedentes primero: sin ellos no se abre «Puntos y análisis». Id fijo en el toast para no apilar avisos
        // (Radix dispara onValueChange dos veces con un mismo clic en un trigger sin foco).
        if (val === 'visita' && !isAntecedentesValid) {
            const i = PASOS_ANT.findIndex((p) => faltanDe(p.id).length > 0);
            if (i >= 0) { setPasoAnt(i); setMaxAnt((m) => Math.max(m, i)); }
            showToast({ id: 'ficha-tab-guard', type: 'warning', message: 'Complete primero los antecedentes obligatorios' });
            return;
        }
        setActiveTab(val);
        scrollToTop();
    };

    const claseTab = 'gap-1.5 rounded-none border-b-2 border-transparent px-4 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none';
    const textoGrabar = puntos.length > 1 ? `Crear visita (${puntos.length} puntos)` : 'Grabar ficha';

    // Resumen de la visita (último paso).
    const enviables = useMemo(() => parametros.filter(seEnvia), [parametros]);
    const idsPuntos = puntos.map((p) => p.id);
    const totalVisita = totalDeLaVisita(enviables, idsPuntos, costoOperativo);

    return (
        <div>
            <SuccessModal
                isOpen={showSuccessModal}
                onClose={handleCloseSuccess}
                onViewFicha={handleViewFicha}
                fichaId={createdFichaId}
                cantidad={createdCount}
            />

            {/* Borrador de una visita que quedó a medias */}
            <Dialog open={!!borradorPendiente} onOpenChange={() => { /* hay que elegir una opción */ }}>
                <DialogContent className="max-w-[540px]" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Tiene una visita sin terminar</DialogTitle>
                        <DialogDescription>
                            {(() => {
                                const nombres = (borradorPendiente?.puntos || []).map((p: PuntoFila) => p.puntoMuestreo).filter(Boolean);
                                return nombres.length > 0 ? `Puntos guardados: ${nombres.join(', ')}. ` : 'Quedó una ficha a medio completar. ';
                            })()}
                            Guardado el {borradorPendiente?.guardadoEn ? new Date(borradorPendiente.guardadoEn).toLocaleString('es-CL') : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:flex-wrap sm:justify-end sm:gap-2">
                        <Button variant="outline" onClick={handleDescartarBorrador}>Descartar y empezar de nuevo</Button>
                        <Button onClick={handleContinuarBorrador}>Continuar donde quedé</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div ref={topRef} className="h-0 overflow-hidden" />
            <PageHeader
                title="Nueva Ficha de Ingreso"
                onBack={handleSalir}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: handleSalir },
                    { label: 'Creación Manual' }
                ]}
            />

            {/* overflow-clip (no -hidden): recorta igual las esquinas, pero sin volverse contenedor de scroll;
                overflow-hidden rompería el position:sticky del pie y de la lista de pasos. */}
            <Card className="overflow-clip p-0">
                {/* activationMode="manual": el modo automático de Radix dispara onValueChange dos veces por un clic. */}
                <Tabs value={activeTab} onValueChange={handleTabChange} activationMode="manual">
                    <div className="flex justify-center border-b border-border px-4">
                        <TabsList className="h-auto gap-1 rounded-none bg-transparent p-0">
                            <TabsTrigger value="antecedentes" className={claseTab} style={{ fontSize: isMobile ? 13.5 : 15 }}>
                                <IconFileText size={isMobile ? 18 : 22} />Antecedentes
                                {isAntecedentesValid && <IconCheck size={14} className="text-success" />}
                            </TabsTrigger>
                            <TabsTrigger value="visita" className={claseTab} style={{ fontSize: isMobile ? 13.5 : 15 }}>
                                <IconMapPin size={isMobile ? 18 : 22} />{isVerySmall ? 'Puntos' : 'Puntos y análisis'}
                                <span className="ml-1 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{puntos.length}</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="antecedentes" forceMount className={cn('mt-0 min-h-[70vh]', activeTab !== 'antecedentes' && 'hidden')}>
                        <PasosLayout
                            titulo="Antecedentes"
                            pasos={pasosAnt}
                            actual={pasoAnt}
                            ayuda={PASOS_ANT[pasoAnt].ayuda}
                            encabezado={{ titulo: PASOS_ANT[pasoAnt].titulo, subtitulo: PASOS_ANT[pasoAnt].subtitulo }}
                            onElegirPaso={(i) => { if (i <= maxAnt) { setPasoAnt(i); scrollToTop(); } }}
                            onAtras={atrasAnt}
                            onBorrador={borradorManual}
                            textoSiguiente={pasoAnt === PASOS_ANT.length - 1 ? 'Continuar a Puntos y análisis' : 'Siguiente'}
                            onSiguiente={siguienteAnt}
                        >
                            {cargandoCotizacion ? (
                                <p className="mt-8 text-center text-sm text-muted-foreground">
                                    Cargando los datos de la cotización…
                                </p>
                            ) : (
                                <>
                                    {prefillCotizacion && (
                                        <div className="mb-6 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
                                            <IconInfoCircle size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                                            <div className="text-muted-foreground">
                                                <p className="m-0 font-medium text-foreground">Desde la cotización N° {prefillCotizacion.numero_cotizacion}</p>
                                                <p className="m-0 mt-1">
                                                    El cliente, el centro y {prefillCotizacion.analisis?.length || 0} análisis vienen cargados
                                                    con el precio que el cliente aceptó. Falta completar objetivo, punto de muestreo y programación.
                                                    {prefillCotizacion.avisos?.length > 0 && (
                                                        <> <strong className="text-foreground">{prefillCotizacion.avisos.length} análisis no se pudieron traer</strong> y hay que agregarlos a mano.</>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    <AntecedentesForm
                                        key={formKey}
                                        ref={antecedentesRef}
                                        initialData={datosIniciales ?? prefillCotizacion?.antecedentes}
                                        onValidationChange={handleValidationChange}
                                        ocultarPunto
                                        modoPasos
                                        pasoActivo={PASOS_ANT[pasoAnt].id}
                                    />
                                </>
                            )}
                        </PasosLayout>
                    </TabsContent>

                    <TabsContent value="visita" forceMount className={cn('mt-0 min-h-[70vh]', activeTab !== 'visita' && 'hidden')}>
                        <PasosLayout
                            titulo="Puntos y análisis"
                            pasos={pasosVis}
                            actual={pasoVis}
                            ayuda={PASOS_VIS[pasoVis].ayuda}
                            encabezado={{ titulo: PASOS_VIS[pasoVis].titulo, subtitulo: PASOS_VIS[pasoVis].subtitulo }}
                            onElegirPaso={(i) => { if (i <= maxVis) { setPasoVis(i); scrollToTop(); } }}
                            onAtras={atrasVis}
                            onBorrador={borradorManual}
                            textoSiguiente={pasoVis === PASOS_VIS.length - 1 ? textoGrabar : 'Siguiente'}
                            onSiguiente={siguienteVis}
                            guardando={isSaving}
                            totalVisita={pasoVis >= 2 ? `${formatoUF(totalVisita)} UF` : undefined}
                        >
                            {/* Los cuatro pasos siguen montados (solo se ocultan) para no perder lo escrito al cambiar de paso. */}
                            <div className={cn(pasoVis !== 0 && 'hidden')}>
                                <PuntosVisitaTable puntos={puntos} onChange={cambiarPuntos} zonas={zonas} zonaNoAplica={zonaNoAplica} />
                                {!puntosOk && pasoVis === 0 && (
                                    <ul className="m-0 mt-4 list-disc pl-5 text-sm text-muted-foreground">
                                        {problemasPuntos.slice(0, 4).map((p) => <li key={p}>{p}</li>)}
                                    </ul>
                                )}
                            </div>
                            <div className={cn(pasoVis !== 1 && 'hidden')}>
                                <ParametrosVisitaForm
                                    puntos={puntos}
                                    parametros={parametros}
                                    onParametrosChange={setParametros}
                                    fuente={fuente}
                                />
                            </div>
                            <div className={cn(pasoVis !== 2 && 'hidden')}>
                                <PrecioVisitaForm
                                    puntos={puntos}
                                    parametros={parametros}
                                    onParametrosChange={setParametros}
                                    costoOperativo={costoOperativo}
                                    onCostoOperativoChange={setCostoOperativo}
                                />
                            </div>
                            <div className={cn(pasoVis !== 3 && 'hidden')}>
                                <div className="mb-4 rounded-xl border border-border p-4">
                                    <div className="text-sm font-bold">Resumen</div>
                                    <div className="text-3xl font-extrabold leading-tight text-primary">
                                        {puntos.length} <span className="text-[15px] font-semibold">{puntos.length === 1 ? 'punto' : 'puntos'}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Total {formatoUF(totalVisita)} UF, con costo operativo de {formatoUF(costoOperativo)} UF
                                    </div>
                                </div>
                                <ResumenVisita
                                    puntos={puntos}
                                    parametros={parametros}
                                    costoOperativo={costoOperativo}
                                    nombreLaboratorio={resolvedor.nombreLaboratorio}
                                    nombreTipoEntrega={resolvedor.nombreTipoEntrega}
                                />
                                <div className="rounded-xl border border-border p-4">
                                    <span className="mb-2 block text-[13px] font-semibold">Observaciones</span>
                                    <div role="radiogroup" aria-label="Observaciones" className="mb-3 flex flex-wrap gap-x-6 gap-y-1">
                                        {[{ v: false, t: 'Sin observaciones' }, { v: true, t: 'Añadir observación' }].map((o) => (
                                            <label key={o.t} className="flex cursor-pointer items-center gap-2 text-sm">
                                                <input type="radio" name="obs-modo" className="h-4 w-4 accent-[var(--primary)]" checked={conObs === o.v} onChange={() => setConObs(o.v)} />
                                                {o.t}
                                            </label>
                                        ))}
                                    </div>
                                    {/* Sigue montado (solo se oculta) para no perder el texto si se vuelve a «Sin observaciones» y de nuevo a «Añadir». */}
                                    <div className={cn(!conObs && 'hidden')}>
                                        <ObservacionesForm
                                            key={obsKey}
                                            ref={observacionesRef}
                                            initialValue={obsInicial}
                                            label="Observación"
                                            placeholder="Escriba la observación…"
                                            onValidationChange={handleObsValidationChange}
                                        />
                                    </div>
                                </div>
                            </div>
                        </PasosLayout>
                    </TabsContent>
                </Tabs>
            </Card>
        </div>
    );
};
