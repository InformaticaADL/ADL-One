import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowDownRight, IconArrowUpRight, IconCheck, IconEqual, IconFileText, IconMapPin, IconPlus, IconTrash } from '@tabler/icons-react';

import { PageHeader } from '../../../components/layout/PageHeader';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { useToast } from '../../../contexts/ToastContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import { fichaService } from '../services/ficha.service';
import { catalogosService } from '../services/catalogos.service';
import { mapToAntecedentes } from '../utils/fichaMapping';
import {
    aCentesimas,
    ajustarParametrosPorCambioDePuntos,
    componerPuntos,
    analisisDelPunto,
    costoOperativoParaEnviar,
    desdeFilaGuardada,
    nuevoPunto,
    formatoUF,
    parteDelCostoOperativo,
    problemasDeParametros,
    problemasDePuntos,
    repartirVisita,
    seEnvia,
    totalDeLaVisita,
    valorDelPuntoConCosto,
    type ParametroVisita,
    type PuntoFila,
} from '../utils/analisisVisita';
import { AntecedentesForm, type AntecedentesFormHandle } from './AntecedentesForm';
import { ParametrosVisitaForm, PrecioVisitaForm } from './AnalisisVisitaForm';
import type { FuenteAnalisis } from './AgregarParametrosDialog';
import { ComponerPuntosDialog } from './ComponerPuntosDialog';
import { ETIQUETAS_BLOQUE, PASOS_ANT, PASOS_VIS, type BloqueAnt } from './FichaCreateForm';
import { PasosLayout, type EstadoPaso, type PasoInfo } from './PasosLayout';
import { PuntosVisitaEditor, type FilaPunto } from './PuntosVisitaEditor';
import { PuntosVisitaTable } from './PuntosVisitaTable';
import { ResumenVisita } from './ResumenVisita';
import type { PuntoDeVisita } from './PuntosVisitaPanel';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Radio } from '@/components/ui/radio';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface Props {
    fichaId: number;
    grupo: { total: number; puntos: PuntoDeVisita[] };
    /** Ficha que se estaba mirando (de ella salen los antecedentes comunes). */
    data: any;
    /** Volver a la visita sin guardar. */
    onVolver: () => void;
    /** Se guardó: la visita debe leerse de nuevo. */
    onGuardado: () => void;
}

const esTerreno = (fila: any) => String(fila?.tipo_analisis || '').trim() === 'Terreno';
const nombreDeFila = (r: any): string => String(r.nombre_tecnica || r.nombre_determinacion || r.nombre_examen || '').trim();

/** Une los análisis de todos los puntos en parámetros: cada uno dice en qué puntos está y a qué precio (igual que al crear la visita). */
function parametrosDeLaVisita(completas: Record<number, any>, ids: number[]): ParametroVisita[] {
    const mapa = new Map<string, ParametroVisita>();
    for (const id of ids) {
        const filas: any[] = (completas[id]?.detalles || []).filter((r: any) => r.tipo_analisis !== 'CostoOperativo');
        for (const fila of filas) {
            const f = { ...fila, nombre_tecnica: nombreDeFila(fila) };
            const clave = `${f.id_referenciaanalisis}|${esTerreno(f) ? 'T' : 'L'}`;
            let p = mapa.get(clave);
            if (!p) {
                p = desdeFilaGuardada(f, []);
                ids.forEach((x) => { p!.en[String(x)] = false; p!.u[String(x)] = 0; });
                mapa.set(clave, p);
            }
            p.en[String(id)] = true;
            // Se respeta el precio guardado de TODAS las filas (también las de terreno): ponerlo en 0 habría borrado esos precios al guardar.
            p.u[String(id)] = aCentesimas(f.uf_individual);
        }
    }
    return [...mapa.values()];
}

/** Pasos de «Puntos y análisis» al editar: los de la creación, salvo que el último es revisar y guardar (no se crea nada). */
const PASOS_EDITAR = [
    { ...PASOS_VIS[0], subtitulo: 'Corrija los puntos de la visita, quite los que sobran o añada puntos nuevos (más abajo).', ayuda: 'Cambie solo lo que haga falta: las filas modificadas quedan marcadas. «Quitar» cancela la ficha del punto al guardar; «Añadir puntos nuevos» crea una ficha más por cada punto.' },
    ...PASOS_VIS.slice(1, 3),
    { id: 'guardar', titulo: 'Revisar y guardar', descripcion: 'Qué cambió y guardar', subtitulo: 'Revise qué se va a guardar. Todos los cambios se aplican de una vez.', ayuda: 'Revise el resumen. Al guardar, la visita vuelve a validación técnica.' },
];

/**
 * «Editar visita»: la misma pantalla por pasos con la que se crea la visita (Antecedentes y Puntos y análisis), con los datos ya cargados.
 * Se va al paso que se quiere cambiar y al final se guarda todo de una vez; solo se guarda lo que cambió. Cada punto conserva lo suyo
 * (nombre, zona, coordenadas y mapa se editan en el paso «Puntos»). Cualquier cambio devuelve la visita a validación técnica.
 */
export const EditarVisitaView: React.FC<Props> = ({ fichaId, grupo, data, onVolver, onGuardado }) => {
    const { showToast } = useToast();
    const catalogos = useCachedCatalogos();
    const [activeTab, setActiveTab] = useState<'antecedentes' | 'visita'>('antecedentes');
    const [pasoAnt, setPasoAnt] = useState(0);
    const [pasoVis, setPasoVis] = useState(0);
    const [guardando, setGuardando] = useState(false);
    const topRef = useRef<HTMLDivElement>(null);
    const subir = () => topRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });

    const ids = useMemo(() => grupo.puntos.map((p) => Number(p.id_fichaingresoservicio)), [grupo]);

    // Puntos marcados para quitar de la visita (se cancelan al guardar, con motivo). `idsActivos` son los que siguen en la visita.
    const [quitados, setQuitados] = useState<number[]>([]);
    const idsActivos = useMemo(() => ids.filter((x) => !quitados.includes(x)), [ids, quitados]);
    const [motivos, setMotivos] = useState<any[]>([]);
    const [motivoId, setMotivoId] = useState('');
    const [obsQuitar, setObsQuitar] = useState('');
    useEffect(() => { catalogosService.getMotivosCancelacionFicha().then((m: any[]) => setMotivos(m || [])).catch(() => setMotivos([])); }, []);

    // Datos completos de cada punto (análisis, precios, costo operativo, ubicación) y catálogos
    const [completas, setCompletas] = useState<Record<number, any> | null>(null);
    const [laboratorios, setLaboratorios] = useState<any[]>([]);
    const [tiposEntrega, setTiposEntrega] = useState<any[]>([]);
    const [zonas, setZonas] = useState<Array<{ value: string; label: string }>>([]);
    const [catalogosListos, setCatalogosListos] = useState(false);
    useEffect(() => {
        let vivo = true;
        Promise.all(ids.map((id) => fichaService.getById(id).then((r: any) => [id, r?.data && r.success !== false ? r.data : r] as const)))
            .then((pares) => { if (vivo) setCompletas(Object.fromEntries(pares)); })
            .catch(() => { if (vivo) showToast({ type: 'error', message: 'No se pudieron leer los puntos de la visita' }); });
        Promise.all([
            catalogos.getLaboratorios().then((l: any[]) => vivo && setLaboratorios(l || [])),
            catalogos.getTiposEntrega().then((t: any[]) => vivo && setTiposEntrega(t || [])),
            catalogos.getZonasUTM().then((z: any[]) => vivo && setZonas((z || []).map((x: any) => ({ value: x.nombre_zonautm, label: x.nombre_zonautm })))),
        ]).catch(() => { /* sin catálogos no se pueden elegir laboratorios ni zonas */ }).finally(() => { if (vivo) setCatalogosListos(true); });
        return () => { vivo = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ids.join(',')]);

    // ─── Antecedentes (comunes a todos los puntos) ────────────────────────────────────────────────────
    const antecedentesRef = useRef<AntecedentesFormHandle>(null);
    const iniciales = useMemo(() => mapToAntecedentes(data, data?.agenda), []); // eslint-disable-line react-hooks/exhaustive-deps
    const [antValidos, setAntValidos] = useState(true);
    const [faltantes, setFaltantes] = useState<string[]>([]);
    const [antTocado, setAntTocado] = useState(false); // el usuario interactuó con el formulario: se guardan de nuevo
    const alValidar = useCallback((ok: boolean, missing?: string[]) => { setAntValidos(ok); setFaltantes(missing || []); }, []);

    // ─── Puntos ───────────────────────────────────────────────────────────────────────────────────────
    const filasIniciales = useMemo<FilaPunto[] | null>(() => {
        if (!completas) return null;
        return ids.map((id) => {
            const d = completas[id] || {};
            const m = String(d.ma_coordenadas || '').match(/^(.*?) UTM ([\d.,]*)E ([\d.,]*)S/);
            return {
                id,
                punto: String(grupo.puntos.find((p) => Number(p.id_fichaingresoservicio) === id)?.punto || d.ma_punto_muestreo || ''),
                zona: m ? m[1] : String(d.ma_coordenadas || ''),
                utmNorte: m ? m[2] : '',
                utmEste: m ? m[3] : '',
                refGoogle: String(d.referencia_googlemaps || '').trim(),
            };
        });
    }, [completas, ids, grupo]);
    const [filas, setFilas] = useState<FilaPunto[] | null>(null);
    useEffect(() => { if (filasIniciales) setFilas(filasIniciales); }, [filasIniciales]);

    // Puntos NUEVOS que se agregan a la visita (cada uno será una ficha más). Lista vacía = no se agrega ninguno.
    const [nuevos, setNuevos] = useState<PuntoFila[]>([]);
    const zonaNoAplica = (z: string) => /^\s*(no\s*aplica|n\/?a)\s*$/i.test(z || '');

    // ─── Análisis y precio ────────────────────────────────────────────────────────────────────────────
    const puntosFila = useMemo<PuntoFila[]>(
        () => [...idsActivos.map((id) => ({ id: String(id), puntoMuestreo: (filas?.find((f) => f.id === id)?.punto) || grupo.puntos.find((p) => Number(p.id_fichaingresoservicio) === id)?.punto || '', zona: '', utmNorte: '', utmEste: '', refGoogle: '' })), ...nuevos],
        [idsActivos, filas, grupo, nuevos],
    );
    const [parametros, setParametros] = useState<ParametroVisita[] | null>(null);
    const [costoOperativo, setCostoOperativo] = useState(0);
    const cambiarNuevos = (lista: PuntoFila[]) => {
        const existentes = ids.map(String);
        setParametros((prev) => (prev ? ajustarParametrosPorCambioDePuntos(prev, [...existentes, ...nuevos.map((p) => p.id)], [...existentes, ...lista.map((p) => p.id)]) : prev));
        setNuevos(lista);
    };
    // Punto compuesto: el laboratorio de los puntos elegidos se toma UNA vez en un punto nuevo; cada uno se queda con su terreno.
    const [componerAbierto, setComponerAbierto] = useState(false);
    const agregarComposicion = (origenes: string[], nombre: string) => {
        const existentes = ids.map(String);
        const zonaSin = zonas.find((z) => zonaNoAplica(z.value))?.value || '';
        const nuevo = nuevoPunto({ puntoMuestreo: nombre, zona: zonaSin });
        setParametros((prev) => {
            if (!prev) return prev;
            const copia = ajustarParametrosPorCambioDePuntos(prev, [...existentes, ...nuevos.map((p) => p.id)], [...existentes, ...nuevos.map((p) => p.id), nuevo.id]);
            componerPuntos(copia, origenes, nuevo.id);
            return copia;
        });
        setNuevos([...nuevos, nuevo]);
    };
    useEffect(() => {
        if (!completas) return;
        setParametros(parametrosDeLaVisita(completas, ids));
        setCostoOperativo(ids.reduce((s, id) => s + (completas[id]?.detalles || []).filter((r: any) => r.tipo_analisis === 'CostoOperativo').reduce((a: number, r: any) => a + aCentesimas(r.uf_individual), 0), 0));
    }, [completas]); // eslint-disable-line react-hooks/exhaustive-deps

    const fuente = useMemo<FuenteAnalisis>(() => ({
        getNormativas: () => catalogos.getNormativas(),
        getReferencias: (id) => catalogos.getReferenciasByNormativa(id),
        getAnalisis: (n, r) => catalogos.getAnalysisByNormativaReferencia(n, r),
        laboratorios,
        tiposEntrega,
    }), [laboratorios, tiposEntrega]); // eslint-disable-line react-hooks/exhaustive-deps
    const resolvedor = useMemo(() => ({
        nombreLaboratorio: (id: number) => String(laboratorios.find((l) => Number(l.id_laboratorioensayo) === id)?.nombre_laboratorioensayo || ''),
        nombreTipoEntrega: (id: number) => String(tiposEntrega.find((t) => Number(t.id_tipoentrega) === id)?.nombre_tipoentrega || ''),
    }), [laboratorios, tiposEntrega]);

    // Lo que se enviaría hoy por análisis y precio, y cómo estaba al abrir (para saber si hay cambios)
    const analisisPorFicha = useMemo(() => {
        if (!parametros) return null;
        const n = idsActivos.length + nuevos.length;
        return idsActivos.map((id, i) => ({
            id,
            analisis: analisisDelPunto(parametros, String(id), resolvedor),
            // El costo operativo es uno por visita: cada punto lleva su parte (igual que al crear la visita)
            costoOperativo: costoOperativoParaEnviar(parteDelCostoOperativo(costoOperativo, n, i)),
        }));
    }, [parametros, costoOperativo, idsActivos, nuevos, resolvedor]);
    // Los puntos nuevos con sus análisis y su parte del costo operativo, tal como los recibe el servidor
    const puntosParaCrear = useMemo(() => {
        if (!parametros || nuevos.length === 0) return [];
        const n = idsActivos.length + nuevos.length;
        return nuevos.map((p, k) => ({
            puntoMuestreo: p.puntoMuestreo.trim(), zona: p.zona || '', utmNorte: p.utmNorte.trim(), utmEste: p.utmEste.trim(), refGoogle: p.refGoogle.trim(),
            analisis: analisisDelPunto(parametros, p.id, resolvedor),
            costoOperativo: costoOperativoParaEnviar(parteDelCostoOperativo(costoOperativo, n, idsActivos.length + k)),
        }));
    }, [parametros, costoOperativo, idsActivos, nuevos, resolvedor]);
    const analisisInicial = useRef<string | null>(null);
    useEffect(() => {
        if (analisisInicial.current === null && analisisPorFicha && catalogosListos) analisisInicial.current = JSON.stringify(analisisPorFicha);
    }, [analisisPorFicha, catalogosListos]);

    // ─── Qué cambió ───────────────────────────────────────────────────────────────────────────────────
    const puntosCambiados = useMemo(
        () => (filas && filasIniciales ? filas.filter((f, i) => !quitados.includes(f.id) && JSON.stringify(f) !== JSON.stringify(filasIniciales[i])) : []),
        [filas, filasIniciales, quitados],
    );
    const analisisCambiado = !!analisisPorFicha && analisisInicial.current !== null && JSON.stringify(analisisPorFicha) !== analisisInicial.current;
    const hayCambios = antTocado || puntosCambiados.length > 0 || analisisCambiado || nuevos.length > 0 || quitados.length > 0;

    const problemasPuntos = useMemo(() => {
        const r: string[] = [];
        if (filas?.some((f) => !quitados.includes(f.id) && !f.punto.trim())) r.push('Todos los puntos deben tener nombre.');
        if (nuevos.length > 0) {
            r.push(...problemasDePuntos(nuevos, zonaNoAplica));
            const existentes = new Set((filas || []).map((f) => f.punto.trim().toLowerCase()));
            nuevos.forEach((p) => { const k = p.puntoMuestreo.trim().toLowerCase(); if (k && existentes.has(k)) r.push(`El punto «${p.puntoMuestreo.trim()}» ya existe en la visita.`); });
        }
        return r;
    }, [filas, nuevos, quitados]); // eslint-disable-line react-hooks/exhaustive-deps
    const problemasParametros = useMemo(
        () => (parametros ? problemasDeParametros(parametros, puntosFila.map((p) => ({ id: p.id, nombre: p.puntoMuestreo.trim() }))) : []),
        [parametros, puntosFila],
    );
    const hayParametros = !!parametros && parametros.some(seEnvia);

    // Quitar puntos: hay que dejar al menos uno, y decir por qué (las fichas se cancelan, no se borran).
    const problemasQuitar = useMemo(() => {
        if (quitados.length === 0) return [] as string[];
        const r: string[] = [];
        if (idsActivos.length === 0) r.push('La visita debe conservar al menos un punto.');
        if (!motivoId || !obsQuitar.trim()) r.push('Para quitar puntos indique el motivo y escriba una observación (en «Revisar y guardar»).');
        return r;
    }, [quitados, idsActivos, motivoId, obsQuitar]);

    // ─── Precio: cuánto era y cuánto queda ─────────────────────────────────────────────────────────────
    // Antes = lo que hoy tienen guardado las fichas (parámetros + su parte del costo operativo). Ahora = lo que sale de la tabla de precios.
    const precioAntes = useMemo(() => {
        if (!completas) return null;
        const porPunto: Record<string, number> = {};
        let total = 0;
        ids.forEach((id) => {
            const v = (completas[id]?.detalles || []).reduce((s: number, r: any) => s + aCentesimas(r.uf_individual), 0);
            porPunto[String(id)] = v; total += v;
        });
        return { porPunto, total };
    }, [completas, ids]);
    const todosLosIds = useMemo(() => puntosFila.map((p) => p.id), [puntosFila]);
    const precioAhora = useMemo(() => {
        if (!parametros) return null;
        const enviables = parametros.filter(seEnvia);
        const porPunto: Record<string, number> = {};
        todosLosIds.forEach((id) => { porPunto[id] = valorDelPuntoConCosto(enviables, todosLosIds, id, costoOperativo); });
        return { porPunto, total: totalDeLaVisita(enviables, todosLosIds, costoOperativo) };
    }, [parametros, todosLosIds, costoOperativo]);
    const [confirmarRepartir, setConfirmarRepartir] = useState(false);
    // Deja el total anterior de la visita y lo reparte en partes iguales entre todos los parámetros de todos los puntos (y el costo operativo).
    const repartirPrecioAnterior = () => {
        if (!parametros || !precioAntes) return;
        const copia = parametros.map((p) => ({ ...p, base: { ...p.base }, en: { ...p.en }, u: { ...p.u } }));
        const nuevoCo = repartirVisita(copia.filter(seEnvia), todosLosIds, { tipo: 'visita', valor: precioAntes.total });
        setParametros(copia);
        setCostoOperativo(nuevoCo);
        setConfirmarRepartir(false);
    };

    // ─── Observación y guardado ───────────────────────────────────────────────────────────────────────
    const [conObs, setConObs] = useState(false);
    const [obs, setObs] = useState('');

    const guardar = async () => {
        if (guardando || !filas || !parametros) return;
        if (!hayCambios) { showToast({ type: 'info', message: 'No hay cambios para guardar.' }); return; }
        // Los puntos nuevos nacen con los antecedentes del formulario (igual que al crear la visita): deben estar completos.
        const antActuales = (antTocado || nuevos.length > 0) ? antecedentesRef.current?.getData() : null;
        const ant = antTocado ? antActuales : null;
        if ((antTocado || nuevos.length > 0) && (!antActuales || !antValidos)) {
            setActiveTab('antecedentes');
            const i = PASOS_ANT.findIndex((p) => faltantes.some((l) => ETIQUETAS_BLOQUE[p.id].includes(l)));
            if (i >= 0) setPasoAnt(i);
            showToast({ type: 'warning', message: 'Complete los antecedentes requeridos.' });
            return;
        }
        if (problemasPuntos.length > 0) { setActiveTab('visita'); setPasoVis(0); showToast({ type: 'warning', message: problemasPuntos[0] }); return; }
        if (problemasQuitar.length > 0) { setActiveTab('visita'); setPasoVis(3); showToast({ type: 'warning', message: problemasQuitar[0] }); return; }
        if ((analisisCambiado || nuevos.length > 0) && (!hayParametros || problemasParametros.length > 0)) {
            setActiveTab('visita'); setPasoVis(1);
            showToast({ type: 'warning', message: problemasParametros[0] || 'Agregue al menos un parámetro.' });
            return;
        }
        if (conObs && !obs.trim()) { showToast({ type: 'warning', message: 'Escriba la observación o elija «Sin observaciones».' }); return; }
        const observaciones = (conObs && obs.trim()) || 'Edición de la visita';

        setGuardando(true);
        const fallos: string[] = [];
        let reenviados = 0;
        let agregados = 0;
        let quitadosN = 0;
        // Las llamadas posteriores a quitar puntos se hacen desde un punto que sigue en la visita
        const refId = idsActivos[0] ?? fichaId;
        try {
            // 1) puntos → 2) antecedentes (cada punto conserva ya su ubicación nueva) → 3) análisis y precio
            let puntosOk = true;
            if (puntosCambiados.length > 0) {
                try {
                    const r = (await fichaService.actualizarPuntosVisita(fichaId, puntosCambiados))?.data;
                    reenviados = Math.max(reenviados, r?.reenviados?.length ?? 0);
                } catch (e: any) { puntosOk = false; fallos.push(`Puntos: ${e?.response?.data?.message || 'no se pudieron guardar'}`); }
            }
            let nuevosOk = true;
            if (puntosOk && nuevos.length > 0 && antActuales) {
                try {
                    const r = (await fichaService.agregarPuntosVisita(fichaId, { antecedentes: antActuales, puntos: puntosParaCrear, observaciones }))?.data;
                    reenviados = Math.max(reenviados, r?.reenviados?.length ?? 0);
                    agregados = r?.creados?.length ?? 0;
                } catch (e: any) { nuevosOk = false; fallos.push(`Puntos nuevos: ${e?.response?.data?.message || 'no se pudieron crear'}`); }
            }
            let quitadosOk = true;
            if (quitados.length > 0 && puntosOk && nuevosOk) {
                try {
                    const r = (await fichaService.quitarPuntosVisita(fichaId, { ids: quitados, idMotivo: Number(motivoId), observacion: obsQuitar.trim() }))?.data;
                    quitadosN = r?.quitados?.length ?? 0;
                    reenviados = Math.max(reenviados, r?.reenviados?.length ?? 0);
                } catch (e: any) { quitadosOk = false; fallos.push(`Quitar puntos: ${e?.response?.data?.message || 'no se pudieron quitar'}`); }
            }
            // Antecedentes y análisis/precio viajan JUNTOS: el servidor los guarda en una sola transacción (todos los puntos o ninguno).
            const hayAnalisisAGuardar = analisisCambiado && !!analisisPorFicha;
            if ((ant || hayAnalisisAGuardar) && puntosOk && nuevosOk && quitadosOk) {
                try {
                    const r = (await fichaService.actualizarVisita(refId, { ...(ant ? { antecedentes: ant } : {}), ...(hayAnalisisAGuardar ? { analisisPorFicha } : {}), observaciones }))?.data;
                    reenviados = Math.max(reenviados, r?.reenviados?.length ?? 0);
                } catch (e: any) { fallos.push(`Antecedentes y análisis: ${e?.response?.data?.message || 'no se pudieron guardar'}`); }
            }
        } finally { setGuardando(false); }

        if (fallos.length > 0) {
            showToast({ type: 'error', message: `No se pudo guardar todo. ${fallos.join(' · ')}` });
            return;
        }
        showToast({ type: 'success', message: `Visita actualizada.${agregados > 0 ? ` Se agregaron ${agregados} ${agregados === 1 ? 'punto' : 'puntos'}.` : ''}${quitadosN > 0 ? ` Se quitaron ${quitadosN} ${quitadosN === 1 ? 'punto' : 'puntos'}.` : ''}${reenviados > 0 ? ' Volvió a validación técnica.' : ''}` });
        onGuardado();
    };

    // Salir con cambios sin guardar: se pregunta con el modal de la web (no con el cuadro del navegador)
    const [confirmarSalida, setConfirmarSalida] = useState(false);
    const salir = () => {
        if (hayCambios) { setConfirmarSalida(true); return; }
        onVolver();
    };

    // ─── Pasos ────────────────────────────────────────────────────────────────────────────────────────
    const faltanDe = (id: BloqueAnt) => faltantes.filter((l) => ETIQUETAS_BLOQUE[id].includes(l));
    const pasosAnt: PasoInfo[] = PASOS_ANT.map((p, i) => {
        const f = faltanDe(p.id).length;
        const estado: EstadoPaso = i === pasoAnt ? 'actual' : f > 0 ? 'error' : 'completo';
        return { id: p.id, titulo: p.titulo, descripcion: p.descripcion, estado, aviso: f > 0 ? `Faltan ${f} ${f > 1 ? 'campos' : 'campo'}` : undefined };
    });
    const problemaVis: Array<string | null> = [
        problemasPuntos[0] ?? null,
        !hayParametros ? 'Agregue al menos un parámetro.' : (problemasParametros[0] ?? null),
        null,
        null,
    ];
    const pasosVis: PasoInfo[] = PASOS_EDITAR.map((p, i) => ({
        id: p.id, titulo: p.titulo, descripcion: p.descripcion, aviso: problemaVis[i] || undefined,
        estado: (i === pasoVis ? 'actual' : problemaVis[i] ? 'error' : 'completo') as EstadoPaso,
    }));

    const irAnt = (i: number) => { setPasoAnt(i); subir(); };
    const irVis = (i: number) => { setPasoVis(i); subir(); };
    const siguienteAnt = () => {
        if (pasoAnt < PASOS_ANT.length - 1) { irAnt(pasoAnt + 1); return; }
        setActiveTab('visita'); setPasoVis(0); subir();
    };
    const siguienteVis = () => { if (pasoVis < PASOS_EDITAR.length - 1) irVis(pasoVis + 1); else guardar(); };
    const atrasAnt = pasoAnt > 0 ? () => irAnt(pasoAnt - 1) : undefined;
    const atrasVis = () => { if (pasoVis > 0) irVis(pasoVis - 1); else { setActiveTab('antecedentes'); irAnt(PASOS_ANT.length - 1); } };

    const total = precioAhora?.total ?? 0;
    // Cuánto era y cuánto queda el precio de la visita, y qué hacer con la diferencia
    const diferencia = (precioAhora?.total ?? 0) - (precioAntes?.total ?? 0);
    const porcentaje = precioAntes && precioAntes.total > 0 ? (diferencia / precioAntes.total) * 100 : 0;
    const nombreDe = (id: string) => puntosFila.find((p) => p.id === id)?.puntoMuestreo || grupo.puntos.find((p) => String(p.id_fichaingresoservicio) === id)?.punto || 'Punto';
    const filasPrecio = precioAntes && precioAhora ? [
        ...ids.map((id) => ({ clave: String(id), nombre: nombreDe(String(id)), antes: precioAntes.porPunto[String(id)] ?? 0, ahora: quitados.includes(id) ? null : (precioAhora.porPunto[String(id)] ?? 0), estado: quitados.includes(id) ? 'quitado' : 'existente' })),
        ...nuevos.map((p) => ({ clave: p.id, nombre: p.puntoMuestreo.trim() || 'Punto nuevo', antes: null as number | null, ahora: precioAhora.porPunto[p.id] ?? 0, estado: 'nuevo' })),
    ] : [];
    const tono = diferencia > 0 ? 'text-warning' : diferencia < 0 ? 'text-success' : 'text-muted-foreground';
    const panelPrecio = precioAntes && precioAhora ? (
        <div className="mb-4 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="text-sm font-bold">Precio de la visita</div>
                    <div className="text-xs text-muted-foreground">Lo que tenían guardado las fichas y cómo queda con estos cambios</div>
                </div>
                <div className="flex items-center gap-4 text-right">
                    <div><small className="block text-[11.5px] text-muted-foreground">Precio anterior</small><b className="text-lg tabular-nums">{formatoUF(precioAntes.total)} UF</b></div>
                    <div><small className="block text-[11.5px] text-muted-foreground">Precio ahora</small><b className="text-lg tabular-nums text-primary">{formatoUF(precioAhora.total)} UF</b></div>
                    <div className={cn('flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 font-semibold', tono)}>
                        {diferencia > 0 ? <IconArrowUpRight size={18} /> : diferencia < 0 ? <IconArrowDownRight size={18} /> : <IconEqual size={18} />}
                        {diferencia === 0 ? 'Sin cambio' : `${diferencia > 0 ? 'Sube' : 'Baja'} ${formatoUF(Math.abs(diferencia))} UF${precioAntes.total > 0 ? ` (${Math.abs(porcentaje).toLocaleString('es-CL', { maximumFractionDigits: 1 })} %)` : ''}`}
                    </div>
                </div>
            </div>
            {(nuevos.length > 0 || quitados.length > 0 || diferencia !== 0) && (
                <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                    <table className="w-full border-collapse text-[13px]">
                        <thead><tr className="bg-muted/40 text-left text-xs font-medium text-muted-foreground"><th className="px-3 py-2">Punto</th><th className="px-3 py-2 text-right">Antes</th><th className="px-3 py-2 text-right">Ahora</th><th className="px-3 py-2 text-right">Diferencia</th></tr></thead>
                        <tbody>
                            {filasPrecio.map((f) => {
                                const d = (f.ahora ?? 0) - (f.antes ?? 0);
                                return (
                                    <tr key={f.clave} className={cn('border-t border-border', f.estado === 'quitado' && 'text-muted-foreground line-through')}>
                                        <td className="px-3 py-1.5">{f.nombre}{f.estado === 'nuevo' && <span className="ml-2 rounded-full bg-primary/10 px-2 text-[11px] font-medium text-primary no-underline">nuevo</span>}{f.estado === 'quitado' && <span className="ml-2 rounded-full bg-destructive/10 px-2 text-[11px] font-medium text-destructive">se quita</span>}</td>
                                        <td className="px-3 py-1.5 text-right tabular-nums">{f.antes === null ? '—' : formatoUF(f.antes)}</td>
                                        <td className="px-3 py-1.5 text-right tabular-nums">{f.ahora === null ? '—' : formatoUF(f.ahora)}</td>
                                        <td className={cn('px-3 py-1.5 text-right tabular-nums', d > 0 ? 'text-warning' : d < 0 ? 'text-success' : 'text-muted-foreground')}>{d === 0 ? '—' : `${d > 0 ? '+' : '−'}${formatoUF(Math.abs(d))}`}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {diferencia !== 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                    <p className="m-0 text-xs text-muted-foreground">
                        ¿Qué hacer con el precio anterior? Puede <b>dejar los precios como están</b> (el total de la visita pasa a {formatoUF(precioAhora.total)} UF) o <b>mantener los {formatoUF(precioAntes.total)} UF</b> y repartirlos entre todos los puntos.
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setConfirmarRepartir(true)}>Repartir los {formatoUF(precioAntes.total)} UF anteriores</Button>
                </div>
            )}
        </div>
    ) : null;

    const claseTab = 'gap-1.5 rounded-none border-b-2 border-transparent px-4 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none';
    const cargando = !completas || !filas || !parametros || !catalogosListos;

    return (
        <div>
            <div ref={topRef} className="h-0 overflow-hidden" />
            <ConfirmModal
                isOpen={confirmarSalida}
                title="Hay cambios sin guardar"
                message="Si sales ahora, los cambios que hiciste en la visita se perderán."
                confirmText="Salir sin guardar"
                cancelText="Seguir editando"
                tone="destructive"
                onConfirm={() => { setConfirmarSalida(false); onVolver(); }}
                onCancel={() => setConfirmarSalida(false)}
            />
            <ConfirmModal
                isOpen={confirmarRepartir}
                title="Repartir el precio anterior"
                message={`Se reemplazan los precios actuales y los ${formatoUF(precioAntes?.total ?? 0)} UF anteriores se reparten en partes iguales entre todos los parámetros de todos los puntos y el costo operativo. Después puede ajustar cada tarifa en el paso Precio.`}
                confirmText="Repartir"
                cancelText="Cancelar"
                tone="info"
                onConfirm={repartirPrecioAnterior}
                onCancel={() => setConfirmarRepartir(false)}
            />
            <ComponerPuntosDialog
                open={componerAbierto}
                onOpenChange={setComponerAbierto}
                puntos={puntosFila.map((p) => ({ id: p.id, nombre: p.puntoMuestreo }))}
                onConfirmar={agregarComposicion}
            />
            <PageHeader
                title={`Editar visita · ${data?.nombre_centro || 'Sin centro'}`}
                subtitle={`${grupo.total} puntos · ${data?.nombre_empresaservicios || data?.nombre_empresa || ''}`}
                onBack={salir}
                breadcrumbItems={[{ label: 'Fichas de Ingreso', onClick: salir }, { label: 'Visita', onClick: salir }, { label: 'Editar visita' }]}
            />
            {cargando ? (
                <Card className="p-8"><p className="m-0 text-center text-sm text-muted-foreground">Cargando la visita…</p></Card>
            ) : (
                <Card className="overflow-clip p-0">
                    <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'antecedentes' | 'visita'); subir(); }} activationMode="manual">
                        <div className="flex justify-center border-b border-border px-4">
                            <TabsList className="h-auto gap-1 rounded-none bg-transparent p-0">
                                <TabsTrigger value="antecedentes" className={claseTab} style={{ fontSize: 15 }}>
                                    <IconFileText size={22} />Antecedentes
                                    {antValidos && antTocado && <IconCheck size={14} className="text-success" />}
                                </TabsTrigger>
                                <TabsTrigger value="visita" className={claseTab} style={{ fontSize: 15 }}>
                                    <IconMapPin size={22} />Puntos y análisis
                                    <span className="ml-1 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{grupo.total}</span>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="antecedentes" forceMount className={cn('mt-0 min-h-[70vh]', activeTab !== 'antecedentes' && 'hidden')}>
                            <PasosLayout
                                titulo="Antecedentes"
                                pasos={pasosAnt}
                                actual={pasoAnt}
                                ayuda={`Lo que cambie aquí se aplica a los ${grupo.total} puntos de la visita. ${PASOS_ANT[pasoAnt].ayuda}`}
                                encabezado={{ titulo: PASOS_ANT[pasoAnt].titulo, subtitulo: PASOS_ANT[pasoAnt].subtitulo }}
                                onElegirPaso={irAnt}
                                onAtras={atrasAnt}
                                textoSiguiente={pasoAnt === PASOS_ANT.length - 1 ? 'Continuar a Puntos y análisis' : 'Siguiente'}
                                onSiguiente={siguienteAnt}
                            >
                                {/* Los eventos del formulario suben hasta aquí (también los de los menús): si el usuario lo tocó, se guardan los antecedentes */}
                                <div onChangeCapture={() => setAntTocado(true)} onInputCapture={() => setAntTocado(true)} onClickCapture={(e) => { if ((e.target as HTMLElement).closest('input,select,textarea,button,[role=combobox],[role=option],[role=radio],[role=checkbox]')) setAntTocado(true); }}>
                                    <AntecedentesForm ref={antecedentesRef} initialData={iniciales} onValidationChange={alValidar} ocultarPunto modoPasos pasoActivo={PASOS_ANT[pasoAnt].id} />
                                </div>
                            </PasosLayout>
                        </TabsContent>

                        <TabsContent value="visita" forceMount className={cn('mt-0 min-h-[70vh]', activeTab !== 'visita' && 'hidden')}>
                            <PasosLayout
                                titulo="Puntos y análisis"
                                pasos={pasosVis}
                                actual={pasoVis}
                                ayuda={PASOS_EDITAR[pasoVis].ayuda}
                                encabezado={{ titulo: PASOS_EDITAR[pasoVis].titulo, subtitulo: PASOS_EDITAR[pasoVis].subtitulo }}
                                onElegirPaso={irVis}
                                onAtras={atrasVis}
                                textoSiguiente={pasoVis === PASOS_EDITAR.length - 1 ? 'Guardar cambios' : 'Siguiente'}
                                onSiguiente={siguienteVis}
                                siguienteDeshabilitado={pasoVis === PASOS_EDITAR.length - 1 && !hayCambios}
                                guardando={guardando}
                                totalVisita={pasoVis >= 2 ? `${formatoUF(total)} UF` : undefined}
                            >
                                {/* Los cuatro pasos siguen montados (solo se ocultan) para no perder lo escrito al cambiar de paso. */}
                                <div className={cn(pasoVis !== 0 && 'hidden')}>
                                    <PuntosVisitaEditor filas={filas!} inicial={filasIniciales!} onChange={setFilas} zonas={zonas} quitados={quitados} onQuitar={(id) => setQuitados((q) => [...q, id])} onDeshacerQuitar={(id) => setQuitados((q) => q.filter((x) => x !== id))} />
                                    <div className="mt-6 border-t border-border pt-5">
                                        {nuevos.length === 0 ? (
                                            <div className="flex flex-wrap items-center gap-3">
                                                <Button type="button" variant="outline" onClick={() => cambiarNuevos([nuevoPunto({ zona: filas?.[filas.length - 1]?.zona || '' })])}>
                                                    <IconPlus size={16} /> Añadir puntos nuevos
                                                </Button>
                                                <span className="text-xs text-muted-foreground">Cada punto nuevo se crea como una ficha más de esta visita.</span>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                                    <h3 className="m-0 text-sm font-semibold">Puntos nuevos ({nuevos.length})</h3>
                                                    <Button type="button" variant="ghost" size="sm" onClick={() => cambiarNuevos([])}><IconTrash size={15} /> Quitar los puntos nuevos</Button>
                                                </div>
                                                <PuntosVisitaTable puntos={nuevos} onChange={cambiarNuevos} zonas={zonas} zonaNoAplica={zonaNoAplica} />
                                                <p className="mb-0 mt-3 text-xs text-muted-foreground">Cada punto nuevo parte con los parámetros y precios del primer punto de la visita; los ajustas en los pasos Parámetros y Precio. El costo operativo se vuelve a repartir entre todos los puntos.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className={cn(pasoVis !== 1 && 'hidden')}>
                                <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
                                    <span className="text-xs text-muted-foreground">¿El laboratorio se toma una sola vez sobre varios puntos? Crea un punto compuesto.</span>
                                    <Button type="button" variant="outline" size="sm" onClick={() => setComponerAbierto(true)}>Componer puntos…</Button>
                                </div>
                                    <ParametrosVisitaForm puntos={puntosFila} parametros={parametros!} onParametrosChange={setParametros} fuente={fuente} />
                                </div>
                                <div className={cn(pasoVis !== 2 && 'hidden')}>
                                    {panelPrecio}
                                    <PrecioVisitaForm puntos={puntosFila} parametros={parametros!} onParametrosChange={setParametros} costoOperativo={costoOperativo} onCostoOperativoChange={setCostoOperativo} />
                                </div>
                                <div className={cn(pasoVis !== 3 && 'hidden')}>
                                    <div className="mb-4 rounded-xl border border-border p-4">
                                        <div className="mb-2 text-sm font-bold">Qué se va a guardar</div>
                                        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13.5px]">
                                            {[
                                                { t: `Antecedentes (los ${grupo.total} puntos)`, c: antTocado, d: antTocado ? 'se guardan' : 'sin cambios' },
                                                { t: 'Puntos', c: puntosCambiados.length > 0, d: puntosCambiados.length > 0 ? `${puntosCambiados.length} ${puntosCambiados.length === 1 ? 'punto cambia' : 'puntos cambian'}` : 'sin cambios' },
                                                { t: 'Puntos nuevos', c: nuevos.length > 0, d: nuevos.length > 0 ? `se crean ${nuevos.length} ${nuevos.length === 1 ? 'ficha' : 'fichas'}` : 'ninguno' },
                                                { t: 'Puntos que se quitan', c: quitados.length > 0, d: quitados.length > 0 ? `se cancelan ${quitados.length} ${quitados.length === 1 ? 'ficha' : 'fichas'}` : 'ninguno' },
                                                { t: 'Análisis y precio', c: analisisCambiado, d: analisisCambiado ? `se guardan, total ${formatoUF(total)} UF` : 'sin cambios' },
                                            ].map((x) => (
                                                <li key={x.t} className="flex items-center gap-2">
                                                    <span className={cn('flex size-5 items-center justify-center rounded-full text-[11px]', x.c ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>{x.c ? <IconCheck size={13} /> : '–'}</span>
                                                    <span className="font-medium">{x.t}</span>
                                                    <span className="text-muted-foreground">· {x.d}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <p className="mb-0 mt-3 text-xs text-muted-foreground">Al guardar, la visita vuelve a validación técnica. Cada punto conserva su nombre, zona, coordenadas y mapa, salvo lo que cambies en «Puntos».</p>
                                    </div>
                                    {panelPrecio}
                                    {quitados.length > 0 && (
                                        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                                            <div className="mb-1 text-sm font-bold">Puntos que se quitan de la visita</div>
                                            <p className="m-0 mb-3 text-xs text-muted-foreground">Se cancelan las fichas de: {quitados.map((q) => `${nombreDe(String(q))} (N° ${q})`).join(', ')}. No se borra nada: queda en el historial. No se puede quitar un punto ya ejecutado, iniciado en terreno o con documentos enviados.</p>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <div>
                                                    <label className="mb-1 block text-xs text-muted-foreground">Motivo *</label>
                                                    <Combobox options={motivos.map((m) => ({ value: String(m.id_motivocancelacion), label: m.nombre_motivo }))} value={motivoId || undefined} onValueChange={(v) => setMotivoId(v || '')} placeholder="Elija el motivo" />
                                                </div>
                                                <div>
                                                    <label className="mb-1 block text-xs text-muted-foreground">Observación *</label>
                                                    <Textarea rows={2} value={obsQuitar} onChange={(e) => setObsQuitar(e.target.value)} placeholder="Por qué se quitan estos puntos" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <ResumenVisita
                                        puntos={puntosFila}
                                        parametros={parametros!}
                                        costoOperativo={costoOperativo}
                                        nombreLaboratorio={resolvedor.nombreLaboratorio}
                                        nombreTipoEntrega={resolvedor.nombreTipoEntrega}
                                    />
                                    <div className="rounded-xl border border-border p-4">
                                        <span className="mb-2 block text-[13px] font-semibold">Observaciones</span>
                                        <div role="radiogroup" aria-label="Observaciones" className="mb-3 flex flex-wrap gap-x-6 gap-y-1">
                                            {[{ v: false, t: 'Sin observaciones' }, { v: true, t: 'Añadir observación' }].map((o) => (
                                                <label key={o.t} className="flex cursor-pointer items-center gap-2.5 text-sm">
                                                    <Radio checked={conObs === o.v} onChange={() => setConObs(o.v)} />
                                                    {o.t}
                                                </label>
                                            ))}
                                        </div>
                                        <div className={cn(!conObs && 'hidden')}>
                                            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Qué se cambió y por qué (queda en el historial de cada punto)" />
                                        </div>
                                    </div>
                                    {!hayCambios && <p className="mb-0 mt-3 text-center text-xs text-muted-foreground">Todavía no hay cambios para guardar.</p>}
                                </div>
                            </PasosLayout>
                        </TabsContent>
                    </Tabs>
                </Card>
            )}
            <div className="mt-3 flex justify-end"><Button variant="ghost" size="sm" onClick={salir}>Salir sin guardar</Button></div>
        </div>
    );
};
