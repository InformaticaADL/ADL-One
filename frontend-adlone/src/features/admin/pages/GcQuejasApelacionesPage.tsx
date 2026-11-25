import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    IconAlertTriangle, IconClipboardList, IconClockHour4, IconDownload, IconFileSpreadsheet, IconFileText, IconFileTypePdf, IconFlag,
    IconHistory, IconLock, IconPlus, IconRefresh, IconScale, IconSearch, IconTool, IconWorld, IconFileDescription,
} from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useToast } from '../../../contexts/ToastContext';
import { useNavStore } from '../../../store/navStore';
import { quejasApelacionesService as api, mensajeError, type Caso, type CasoRow, type TipoCaso } from '../services/quejasApelaciones.service';
import { AvanceCaso } from '../components/quejas-apelaciones/comun';
import { ESTADOS, descargarCsv, estadoVariant, fmtDay, today, yesNo } from '../components/quejas-apelaciones/reglas';
import { RegistroTab } from '../components/quejas-apelaciones/RegistroTab';
import { EvaluacionTab } from '../components/quejas-apelaciones/EvaluacionTab';
import { TratamientoTab } from '../components/quejas-apelaciones/TratamientoTab';
import { NotificacionesTab } from '../components/quejas-apelaciones/NotificacionesTab';
import { HistorialTab } from '../components/quejas-apelaciones/HistorialTab';
import { CorreosCaso } from '../components/quejas-apelaciones/CorreosCaso';
import { NuevoRegistroVista } from '../components/quejas-apelaciones/NuevoRegistroVista';
import { FormularioOIFoGe05 } from '../components/quejas-apelaciones/FormularioOIFoGe05';
import { valoresDeCaso } from '../components/quejas-apelaciones/formularioValores';
import { exportarCasosExcel } from '../components/quejas-apelaciones/exportarExcel';
import { exportarFichaPdf } from '../components/quejas-apelaciones/fichaPdf';

// =============================================================================
// G. Calidad → Calidad → Quejas  /  Apelaciones (NCh-ISO/IEC 17025 cl. 7.9).
// Una misma pantalla para cada sección, filtrada por tipo. Los casos viven en la
// base de ADLWeb: llegan por el formulario público (adldiagnostic.cl) o se
// registran aquí, y también se administran desde el panel de ADLWeb.
// Acceso: área de Gestión de Calidad (e Informática); lo valida el backend.
// =============================================================================

type Stage = 'historial' | 'registro' | 'evaluacion' | 'tratamiento' | 'notificaciones' | 'formulario';
type MainTab = 'registro' | 'evaluacion' | 'tratamiento';
type Vista = { modo: 'lista' } | { modo: 'nuevo' } | { modo: 'caso'; id: number; stage: Stage };
const TODOS = '__todos__';
const TEXTOS = {
    queja: { seccion: 'Quejas', singular: 'queja', nuevo: 'Nueva queja', vacia: 'Aún no hay quejas registradas.' },
    apelacion: { seccion: 'Apelaciones', singular: 'apelación', nuevo: 'Nueva apelación', vacia: 'Aún no hay apelaciones registradas.' },
};

/** Plazo del caso con ícono + texto: vencido, por vencer (≤ 3 días) o fecha. */
function PlazoCelda({ r }: { r: CasoRow }) {
    if (r.cerrado) return <span className="text-sm text-muted-foreground">Cerrado {fmtDay(r.cerrado_en)}</span>;
    if (r.vencida) return <span className="inline-flex items-center gap-1 text-sm font-semibold text-destructive"><IconAlertTriangle size={14} />{fmtDay(r.plazo_vence)} · vencido</span>;
    const dias = r.plazo_vence ? Math.round((new Date(`${r.plazo_vence}T12:00:00`).getTime() - new Date(`${today()}T12:00:00`).getTime()) / 86400000) : null;
    if (dias !== null && dias <= 5) return <span className="inline-flex items-center gap-1 text-sm font-medium text-warning"><IconClockHour4 size={14} />{fmtDay(r.plazo_vence)} · {dias === 0 ? 'vence hoy' : `en ${dias} día${dias === 1 ? '' : 's'}`}</span>;
    return <span className="text-sm">{fmtDay(r.plazo_vence)}</span>;
}

function CasosTable({ rows, onOpen, empty }: { rows: CasoRow[]; onOpen: (id: number) => void; empty: string }) {
    if (!rows.length) return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;
    return (
        <div className="overflow-x-auto rounded-lg border border-border">
            <Table className="min-w-[820px]">
                <TableHeader>
                    <TableRow>
                        <TableHead>N°</TableHead><TableHead>Origen</TableHead><TableHead>Empresa / nombre</TableHead>
                        <TableHead>Recepción</TableHead><TableHead>Estado</TableHead><TableHead>Responsable</TableHead><TableHead>Plazo</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((r) => (
                        <TableRow key={r.id} tabIndex={0} className="cursor-pointer" title="Abrir el caso y su historial"
                            onClick={() => onOpen(r.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(r.id); }}>
                            <TableCell><span className="font-mono text-sm font-bold text-primary">{r.folio}</span></TableCell>
                            <TableCell><Badge variant="outline">{r.origenLabel}</Badge></TableCell>
                            <TableCell><p className="text-sm font-medium">{r.empresa}</p><p className="text-xs text-muted-foreground">{r.nombre}</p></TableCell>
                            <TableCell>
                                <p className="text-sm">{fmtDay(r.fecha_recepcion)}</p>
                                <p className="flex items-center gap-1 text-xs text-muted-foreground">{r.hora_recepcion} · {r.canal === 'web' ? <><IconWorld size={12} />Web</> : 'Panel'}</p>
                            </TableCell>
                            <TableCell>
                                <Badge variant={estadoVariant(r.estado)}>{r.estadoLabel}</Badge>
                                {Boolean(r.acciones_abiertas) && <p className="text-xs text-warning">{r.acciones_abiertas} AC abierta{r.acciones_abiertas === 1 ? '' : 's'}</p>}
                                {r.causa && <p className="text-xs text-muted-foreground">{r.causa}</p>}
                            </TableCell>
                            <TableCell className="text-sm">{r.responsable || '—'}</TableCell>
                            <TableCell><PlazoCelda r={r} /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

/** Ficha del caso: abre en el historial; luego las etapas, correos y la vista del formulario. */
function CasoDetalle({ id, stage, causas, onChanged }: { id: number; stage: Stage; causas: string[]; onChanged: () => void }) {
    const { showToast } = useToast();
    const [caso, setCaso] = useState<Caso | null>(null);
    const [tab, setTab] = useState<Stage>(stage);
    // Cada guardado sube la versión: se vuelven a leer el caso, su historial y sus correos.
    // El padre usa key={id-stage}: al abrir otro caso el componente se monta de nuevo.
    const [version, setVersion] = useState(0);
    useEffect(() => {
        let vigente = true;
        api.obtener(id)
            .then((detalle) => { if (vigente) setCaso(detalle); })
            .catch((e) => showToast({ type: 'error', message: mensajeError(e, 'No se pudo cargar el caso') }));
        return () => { vigente = false; };
    }, [id, version, showToast]);
    const saved = () => { setVersion((v) => v + 1); onChanged(); };
    const valores = useMemo(() => (caso ? valoresDeCaso(caso) : null), [caso]);

    if (!caso || !valores) return <p className="py-10 text-center text-sm text-muted-foreground">Cargando caso…</p>;
    const sinInicio = !caso.notificaciones.some((n) => n.etapa === 'inicio');
    const formulario = () => api.descargar(`/${caso.id}/formulario`, `OI-FoGe-05 ${caso.folio}.odt`)
        .catch(() => showToast({ type: 'error', message: 'No se pudo generar el formulario OI-FoGe-05' }));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg font-bold text-primary">{caso.folio}</span>
                    <Badge variant="outline">{caso.origenLabel}</Badge>
                    <Badge variant={estadoVariant(caso.estado)}>{caso.estadoLabel}</Badge>
                    {caso.vencida && <Badge variant="destructive" className="gap-1"><IconAlertTriangle size={12} />Fuera de plazo</Badge>}
                    <span className="text-sm text-muted-foreground">{caso.empresa} · {caso.nombre}{caso.plazo_vence && !caso.cerrado ? ` · plazo ${fmtDay(caso.plazo_vence)}` : ''}</span>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" onClick={formulario} title="Formulario oficial de Gestión de Calidad con los datos del caso (.odt, se abre con Word o LibreOffice)">
                        <IconFileText size={14} />OI-FoGe-05 (.odt)
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => exportarFichaPdf(caso)}><IconFileTypePdf size={14} />Ficha PDF</Button>
                </div>
            </div>
            <AvanceCaso caso={caso} />
            <Tabs value={tab} onValueChange={(v) => setTab(v as Stage)}>
                <TabsList className="h-auto flex-wrap justify-start">
                    <TabsTrigger value="historial" className="gap-1.5"><IconHistory size={15} />Historial</TabsTrigger>
                    <TabsTrigger value="registro" className="gap-1.5"><IconClipboardList size={15} />1. Registro</TabsTrigger>
                    <TabsTrigger value="evaluacion" className="gap-1.5"><IconScale size={15} />2. Evaluación</TabsTrigger>
                    <TabsTrigger value="tratamiento" className="gap-1.5"><IconTool size={15} />3. Tratamiento</TabsTrigger>
                    <TabsTrigger value="notificaciones" className="gap-1.5">
                        <IconFlag size={15} />Correos y notificaciones ({caso.notificaciones.length})
                        {sinInicio && <IconAlertTriangle size={14} className="text-warning" aria-label="Falta el inicio" />}
                    </TabsTrigger>
                    <TabsTrigger value="formulario" className="gap-1.5"><IconFileDescription size={15} />Formulario</TabsTrigger>
                </TabsList>
                <TabsContent value="historial" className="pt-3"><HistorialTab casoId={caso.id} version={version} /></TabsContent>
                <TabsContent value="registro" className="pt-3"><RegistroTab caso={caso} onSaved={saved} /></TabsContent>
                <TabsContent value="evaluacion" className="pt-3"><EvaluacionTab caso={caso} onSaved={saved} causas={causas} /></TabsContent>
                <TabsContent value="tratamiento" className="pt-3"><TratamientoTab caso={caso} onSaved={saved} /></TabsContent>
                <TabsContent value="notificaciones" className="pt-3">
                    <div className="flex flex-col gap-4">
                        <CorreosCaso casoId={caso.id} version={version} onCambio={saved} />
                        <NotificacionesTab caso={caso} onSaved={saved} />
                    </div>
                </TabsContent>
                <TabsContent value="formulario" className="pt-3">
                    <p className="mb-2 text-xs text-muted-foreground">Vista del OI-FoGe-05 con los datos actuales del caso. El documento oficial es el .odt (botón «OI-FoGe-05»).</p>
                    <div className="rounded-lg bg-muted/40 p-3"><FormularioOIFoGe05 v={valores} /></div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

interface Props { tipo: TipoCaso; onBack: () => void }

export const GcQuejasApelacionesPage: React.FC<Props> = ({ tipo, onBack }) => {
    const { setActiveSubmodule, pendingQaCasoId, setPendingQaCasoId } = useNavStore();
    const { showToast } = useToast();
    const t = TEXTOS[tipo];
    const [tab, setTab] = useState<MainTab>('registro');
    const [rows, setRows] = useState<CasoRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [sinAcceso, setSinAcceso] = useState<string | null>(null);
    const [q, setQ] = useState('');
    const [estado, setEstado] = useState(TODOS);
    // Llegando desde un aviso de la campana (o del dashboard): se abre ese caso.
    const [vista, setVista] = useState<Vista>(() => (pendingQaCasoId ? { modo: 'caso', id: pendingQaCasoId, stage: 'historial' } : { modo: 'lista' }));
    // Si llega otro aviso estando ya en la pantalla, se abre ese caso (ajuste durante el render, sin efecto).
    const [pedido, setPedido] = useState(pendingQaCasoId);
    if (pendingQaCasoId !== pedido) {
        setPedido(pendingQaCasoId);
        if (pendingQaCasoId) setVista({ modo: 'caso', id: pendingQaCasoId, stage: 'historial' });
    }
    // Consumido: se limpia del store para no reabrirlo al volver a la pantalla.
    useEffect(() => { if (pendingQaCasoId) setPendingQaCasoId(null); }, [pendingQaCasoId, setPendingQaCasoId]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const lista = await api.listar(tipo);
            setRows(lista);
            setSinAcceso(null);
        } catch (e) {
            const status = (e as { response?: { status?: number } })?.response?.status;
            if (status === 403) setSinAcceso(mensajeError(e, 'Quejas y apelaciones es exclusivo del área de Gestión de Calidad.'));
            else showToast({ type: 'error', message: mensajeError(e, 'No se pudieron cargar los casos') });
        } finally {
            setLoading(false);
        }
    }, [tipo, showToast]);
    useEffect(() => { load(); }, [load]);

    const term = q.trim().toLowerCase();
    const filtered = rows.filter((r) => (estado === TODOS || r.estado === estado)
        && (!term || [r.folio, r.empresa, r.nombre, r.correo, r.numero_informe, r.responsable, r.causa, r.jefe_area].some((v) => (v || '').toLowerCase().includes(term))));
    const porEvaluar = rows.filter((r) => r.estado === 'registrada' || r.estado === 'en_evaluacion');
    const enTratamiento = rows.filter((r) => r.estado === 'en_tratamiento');
    const vencidos = rows.filter((r) => r.vencida).length;
    const causas = useMemo(() => [...new Set(rows.map((r) => r.causa).filter((c): c is string => Boolean(c)))], [rows]);

    const exportCsv = () => descargarCsv([
        ['N°', 'Tipo', 'Origen', 'Canal', 'Empresa', 'Nombre', 'Mail de contacto', 'Fono de contacto', 'Fecha recepción', 'Hora recepción',
            'Fecha tratamiento', 'N° informe', 'Estado', 'Presentada por', 'Vía de ingreso', 'Causa', 'Jefe de área', 'Procede', 'Responsable', 'AC abiertas', 'Plazo', 'Cierre'],
        ...filtered.map((r) => [
            r.folio, r.tipoLabel, r.origenLabel, r.canalLabel, r.empresa, r.nombre, r.correo, r.telefono, fmtDay(r.fecha_recepcion), r.hora_recepcion,
            fmtDay(r.fecha_tratamiento), r.numero_informe || '', r.estadoLabel, r.emisorLabel || '', r.via_ingreso || '', r.causa || '', r.jefe_area || '',
            yesNo(r.procede), r.responsable || '', r.acciones_abiertas || 0, fmtDay(r.plazo_vence), fmtDay(r.cerrado_en),
        ]),
    ], `${t.seccion.toLowerCase()}-${today()}.csv`);

    const casoAbierto = vista.modo === 'caso' ? rows.find((r) => r.id === vista.id) : undefined;
    const volverLista = () => setVista({ modo: 'lista' });
    const migas = [
        { label: 'Calidad', onClick: () => setActiveSubmodule('gc-hub-cal') },
        { label: t.seccion, onClick: vista.modo !== 'lista' ? volverLista : undefined },
        ...(vista.modo === 'caso' ? [{ label: casoAbierto?.folio || 'Caso' }] : vista.modo === 'nuevo' ? [{ label: t.nuevo }] : []),
    ];
    const marco = (children: React.ReactNode) => <div className="shadcn-scope w-full p-4 md:p-6">{children}</div>;

    if (sinAcceso) {
        return marco(<><PageHeader title={t.seccion} onBack={onBack} breadcrumbItems={migas} /><Alert><IconLock /><AlertDescription>{sinAcceso}</AlertDescription></Alert></>);
    }
    if (vista.modo === 'nuevo') {
        return marco(<>
            <PageHeader title={t.nuevo} subtitle={`Registro manual de ${t.singular} · NCh-ISO/IEC 17025 cl. 7.9`} onBack={volverLista} breadcrumbItems={migas} />
            <NuevoRegistroVista tipo={tipo} onCancel={volverLista} onCreated={(id) => { load(); setVista({ modo: 'caso', id, stage: 'historial' }); }} />
        </>);
    }
    if (vista.modo === 'caso') {
        return marco(<>
            <PageHeader title={`${tipo === 'apelacion' ? 'Apelación' : 'Queja'} ${casoAbierto?.folio || ''}`} subtitle="NCh-ISO/IEC 17025 cl. 7.9" onBack={volverLista} breadcrumbItems={migas} />
            <CasoDetalle key={`${vista.id}-${vista.stage}`} id={vista.id} stage={vista.stage} causas={causas} onChanged={load} />
        </>);
    }

    const abrir = (stage: Stage) => (id: number) => setVista({ modo: 'caso', id, stage });
    return marco(<>
        <PageHeader
            title={t.seccion}
            subtitle={`Registro de ${t.seccion.toLowerCase()} del área de Medioambiente (NCh-ISO/IEC 17025 cl. 7.9). Incluye las recibidas por adldiagnostic.cl; también se administran desde el panel de ADLWeb.`}
            onBack={onBack}
            breadcrumbItems={migas}
            rightSection={(
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="icon" onClick={load} disabled={loading} aria-label="Actualizar" title="Actualizar">
                        <IconRefresh size={16} className={cn(loading && 'animate-spin')} />
                    </Button>
                    <Button variant="outline" onClick={() => exportarCasosExcel(filtered, t.seccion).catch(() => showToast({ type: 'error', message: 'No se pudo generar el Excel' }))} disabled={!filtered.length}>
                        <IconFileSpreadsheet size={16} />Excel
                    </Button>
                    <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><IconDownload size={16} />CSV</Button>
                    <Button onClick={() => setVista({ modo: 'nuevo' })}><IconPlus size={16} />{t.nuevo}</Button>
                </div>
            )}
        />
        {vencidos > 0 && (
            <Alert variant="destructive" className="mb-3"><IconAlertTriangle /><AlertDescription>
                {vencidos} {vencidos === 1 ? `${t.singular} está` : `${t.seccion.toLowerCase()} están`} fuera del plazo de respuesta. Revisa el dashboard de Calidad para ver todos los plazos.
            </AlertDescription></Alert>
        )}
        <Tabs value={tab} onValueChange={(v) => setTab(v as MainTab)}>
            <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value="registro" className="gap-1.5"><IconClipboardList size={15} />Registro de {t.seccion.toLowerCase()} <Badge variant="secondary">{rows.length}</Badge></TabsTrigger>
                <TabsTrigger value="evaluacion" className="gap-1.5"><IconScale size={15} />Por evaluar {porEvaluar.length > 0 && <Badge variant="warning">{porEvaluar.length}</Badge>}</TabsTrigger>
                <TabsTrigger value="tratamiento" className="gap-1.5"><IconTool size={15} />En tratamiento {enTratamiento.length > 0 && <Badge variant="warning">{enTratamiento.length}</Badge>}</TabsTrigger>
            </TabsList>
            <TabsContent value="registro" className="pt-3">
                <div className="mb-3 flex flex-wrap gap-2">
                    <div className="relative min-w-[240px] flex-1">
                        <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-9" placeholder="Buscar por N°, empresa, nombre, mail, informe o responsable" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                    <Select value={estado} onValueChange={setEstado}>
                        <SelectTrigger className="w-52" aria-label="Estado"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={TODOS}>Todos los estados</SelectItem>
                            {ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {loading && !rows.length
                    ? <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>
                    : <CasosTable rows={filtered} onOpen={abrir('historial')} empty={rows.length ? 'Ningún caso coincide con la búsqueda.' : t.vacia} />}
            </TabsContent>
            <TabsContent value="evaluacion" className="pt-3">
                <p className="mb-3 text-sm text-muted-foreground">Pendientes de validar: ¿se relacionan con las actividades del laboratorio y proceden? (cl. 7.9.2)</p>
                <CasosTable rows={porEvaluar} onOpen={abrir('evaluacion')} empty="No hay casos pendientes de evaluación." />
            </TabsContent>
            <TabsContent value="tratamiento" className="pt-3">
                <p className="mb-3 text-sm text-muted-foreground">Casos que proceden: análisis de causa, acciones, conclusiones, aprobación independiente y respuesta formal.</p>
                <CasosTable rows={enTratamiento} onOpen={abrir('tratamiento')} empty="No hay casos en tratamiento." />
            </TabsContent>
        </Tabs>
    </>);
};
