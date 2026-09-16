import { useEffect, useState } from 'react';
import { fichaService } from '../services/ficha.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { WorkflowAlert } from '../../../components/ui/WorkflowAlert';
import { cn } from '@/lib/utils';
import {
    IconArrowLeft,
    IconDatabase,
    IconTool,
    IconPhoto,
    IconSignature,
    IconCalendarTime,
    IconMapPin,
    IconFlask,
    IconFileText,
    IconDownload,
    IconExternalLink,
    IconSend,
    IconChevronDown,
    IconChevronUp,
    IconRefresh,
    IconCheck,
    IconMailForward,
    IconInfoCircle,
    IconAlertTriangle
} from '@tabler/icons-react';
import { useNavStore } from '../../../store/navStore';
import apiClient from '../../../config/axios.config';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';

// El backend (mssql) devuelve los datetime guardados con GETDATE() (hora local del servidor)
// como si fueran UTC. Usamos los componentes UTC para evitar que el navegador
// reste el offset horario nuevamente.
const formatFechaHoraServidor = (value: string | Date) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

function KV({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="text-[13px] text-muted-foreground">{label}</span>
            <span className="text-[13px] font-semibold" style={color ? { color } : undefined}>{value}</span>
        </div>
    );
}

export const FichaDetailView = () => {
    const {
        selectedFichaId,
        selectedCorrelativo,
        setActiveSubmodule,
        activeModule,
        setHelpCenterOpen,
    } = useNavStore();
    const { hasPermission, user } = useAuth();
    const { showToast } = useToast();
    const isGemMamPm = hasPermission('GEM_REALIZADO');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<any>(null);
    const [openedImage, setOpenedImage] = useState<string | null>(null);
    const [expandedDocs, setExpandedDocs] = useState<string[]>([]);

    const [resendModalOpen, setResendModalOpen] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<any>(null);
    const [resendTo, setResendTo] = useState(user?.email || '');
    const [resendCc, setResendCc] = useState('');
    const [resendLoading, setResendLoading] = useState(false);
    const [resendError, setResendError] = useState('');
    const [resendSuccess, setResendSuccess] = useState(false);

    const [realizadoGem, setRealizadoGem] = useState<{realizado: boolean, userName: string, fecha: string} | null>(null);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [realizadoLoading, setRealizadoLoading] = useState(false);
    const [oiNumero, setOiNumero] = useState('');
    const [oiError, setOiError] = useState('');
    const [generarFoma, setGenerarFoma] = useState(true);
    const [generarCadena, setGenerarCadena] = useState(true);

    const toggleDoc = (docId: string) => {
        setExpandedDocs(prev =>
            prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
        );
    };

    const handleResend = async () => {
        setResendError('');
        setResendLoading(true);
        try {
            await fichaService.enviarDocumentoManual({
                idFicha: Number(selectedFichaId),
                correlativo: selectedCorrelativo as string,
                documento: selectedDocument,
                to: resendTo,
                cc: resendCc
            });
            setResendSuccess(true);
        } catch (e: any) {
            setResendError(e.response?.data?.message || 'Error al reenviar el documento');
        } finally {
            setResendLoading(false);
        }
    };

    useEffect(() => {
        const fetchDetail = async () => {
            if (!selectedFichaId || !selectedCorrelativo) {
                setError('No se ha seleccionado ninguna ficha');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const response = await apiClient.get(`/api/fichas/${selectedFichaId}/execution-detail`, {
                    params: { correlativo: selectedCorrelativo }
                });
                const responseData = response.data.data || response.data;
                setData(responseData);
                // Load realizado GEM state from agenda data
                const agendaData = responseData?.ficha;
                if (agendaData?.realizado_por_gem) {
                    setRealizadoGem({
                        realizado: true,
                        userName: agendaData.realizado_por_gem,
                        fecha: agendaData.fecha_realizado_gem
                            ? formatFechaHoraServidor(agendaData.fecha_realizado_gem)
                            : ''
                    });
                }
                setError(null);
            } catch (err: any) {
                console.error('Error fetching detail:', err);
                setError(err.response?.data?.message || 'Error al cargar los detalles de la ficha');
            } finally {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [selectedFichaId, selectedCorrelativo]);

    const handleBack = () => {
        if (activeModule === 'gem' || activeModule === 'unidades-gem') {
            setActiveSubmodule('gem-muestreos-completados');
        } else {
            setActiveSubmodule('ma-fichas-ingreso');
        }
    };

    const handleConfirmRealizado = async () => {
        if (!ficha?.id_agendamam) return;

        // Validate OI input
        const trimmed = oiNumero.trim();
        if (!trimmed) {
            setOiError('Debes ingresar el ID de caso generado por ADL Soft.');
            return;
        }
        const fullCode = `OI-${trimmed}`;
        if (fullCode.length > 10) {
            setOiError(`El código "${fullCode}" supera los 10 caracteres permitidos.`);
            return;
        }

        setOiError('');
        setRealizadoLoading(true);
        try {
            // 1. Marcar como realizado por GEM
            await fichaService.updateRealizadoGem(Number(ficha.id_agendamam), true);
            // 2. Asignar el código OI (debe quedar guardado en BD antes de regenerar
            // documentos, porque el PDF lee caso_adlab en vivo desde la base de datos)
            await fichaService.updateCasoAdlab(Number(ficha.id_agendamam), fullCode);

            // Update local state so header reflects the new OI
            setData((prev: any) => {
                if (!prev || !prev.ficha) return prev;
                return {
                    ...prev,
                    ficha: {
                        ...prev.ficha,
                        caso_adlab: fullCode,
                        id_caso: parseInt(trimmed, 10)
                    }
                };
            });

            setRealizadoGem({
                realizado: true,
                userName: user?.name || user?.username || 'Usuario',
                fecha: new Date().toLocaleString('es-CL')
            });
            setConfirmModalOpen(false);
            setOiNumero('');
            showToast({ type: 'success', message: `Muestreo marcado como realizado. Caso ${fullCode} asignado correctamente.` });

            // 3. Regenerar documentos (FoMa / Cadena de Custodia) con el nuevo ID Caso,
            // si el usuario dejó los switches marcados. No bloquea el flujo si falla.
            if (generarFoma || generarCadena) {
                try {
                    const regenResult = await fichaService.regenerarDocumentos(Number(ficha.id_agendamam), {
                        foma: generarFoma,
                        cadena: generarCadena
                    });
                    const fallos: string[] = [];
                    if (generarFoma && regenResult?.data?.foma && !regenResult.data.foma.ok) {
                        fallos.push(`FoMa: ${regenResult.data.foma.error || 'error desconocido'}`);
                    }
                    if (generarCadena && regenResult?.data?.cadena && !regenResult.data.cadena.ok) {
                        fallos.push(`Cadena de Custodia: ${regenResult.data.cadena.error || 'error desconocido'}`);
                    }
                    if (fallos.length > 0) {
                        showToast({ type: 'warning', message: `Caso ${fullCode} guardado, pero no se pudo regenerar: ${fallos.join('; ')}` });
                    }
                } catch (regenErr: any) {
                    console.error('Error al regenerar documentos:', regenErr);
                    showToast({ type: 'warning', message: `Caso ${fullCode} guardado, pero falló la regeneración de documentos.` });
                }
            }
        } catch (err: any) {
            console.error('Error al marcar como realizado:', err);
            const message = err.response?.data?.message || 'Ocurrió un error al guardar. Intenta nuevamente.';
            setOiError(message);
            showToast({ type: 'error', message });
        } finally {
            setRealizadoLoading(false);
        }
    };

    const handleDownload = async (url: string, fileName: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Error downloading file:', error);
        }
    };

    if (loading) {
        return (
            <div className="shadcn-scope w-full p-8">
                <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-base">Cargando detalles de la ejecución...</span>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="shadcn-scope w-full p-8">
                <WorkflowAlert type="error" title="Error" message={error || 'No se pudo cargar la información'} />
                <Button variant="outline" className="mt-4" onClick={handleBack}>
                    <IconArrowLeft size={16} /> Volver
                </Button>
            </div>
        );
    }

    const { ficha, equipos, analisis, media, procesos } = data;

    // ✅ PUNTUAL = un solo proceso, una sola fecha (no se divide en instalación/retiro).
    // El backend duplica los mismos valores en las columnas *i (instalación) y *t (retiro),
    // así que para Puntual basta con leer los campos *i / "instalacion" como el único muestreo.
    const isPuntual = (ficha?.tipo_fichaingresoservicio || '').toString().trim().toLowerCase() === 'puntual';

    // Helper to format values consistently
    const fmt = (v: any) => (v !== null && v !== undefined && v !== '' ? String(v) : '—');

    // Improved date formatter DD-MM-YYYY
    const parseFechaStr = (str: string) => {
        if (!str || str === 'Invalid Date' || str === '—') return '—';
        try {
            // Handle YYYY-MM-DD from backend
            const [year, month, day] = str.split('-');
            if (year && month && day && year.length === 4) {
                return `${day}-${month}-${year}`;
            }
            // Fallback for DD/MM/YYYY
            return str.replace(/\//g, '-');
        } catch (e) {
            return str;
        }
    };

    const isRechazada = (ficha?.estado_ficha || '').toUpperCase().includes('RECHAZADA');
    const showUf = hasPermission('FI_EXP_VER_UF');

    const equiposInstUsados = equipos?.filter((e: any) => e.usado_instalacion === 'S' || e.usado_retiro === 'S')
        .filter((e: any, idx: number, arr: any[]) => arr.findIndex((o: any) => o.codigo === e.codigo) === idx) || [];
    const equiposInstalacion = equipos?.filter((e: any) => e.usado_instalacion === 'S') || [];
    const equiposRetiro = equipos?.filter((e: any) => e.usado_retiro === 'S') || [];

    const analisisTerreno = analisis?.filter((item: any) => item.tipo_analisis !== 'Laboratorio' && item.tipo_analisis !== 'CostoOperativo') || [];
    const analisisLaboratorio = analisis?.filter((item: any) => item.tipo_analisis === 'Laboratorio') || [];

    const fotosPuntual = media?.ma_fotografia?.split(';').filter((p: string) => p.toLowerCase().includes('instalacion') || p.toLowerCase().includes('retiro'))
        .filter((p: string, idx: number, arr: string[]) => arr.indexOf(p) === idx);
    const fotosInstalacion = media?.ma_fotografia?.split(';').filter((p: string) => p.toLowerCase().includes('instalacion'));
    const fotosRetiro = media?.ma_fotografia?.split(';').filter((p: string) => p.toLowerCase().includes('retiro'));

    return (
        <div className="shadcn-scope w-full max-w-full overflow-x-hidden p-4">

            {/* Header */}
            <Card className="mb-4 overflow-hidden" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
                <div className="grid items-center gap-6 p-6" style={{ gridTemplateColumns: '3fr 7fr 2fr' }}>
                    <div className="flex items-start gap-2">
                        <Button variant="ghost" size="icon" className="mt-1" onClick={handleBack}>
                            <IconArrowLeft size={20} />
                        </Button>
                        <div>
                            <h2 className="m-0 text-2xl font-bold leading-tight text-primary">{ficha?.caso_adlab || 'Caso S/N'}</h2>
                            <span className="mt-1 block text-xs font-semibold text-muted-foreground">{ficha?.frecuencia_correlativo || 'Correlativo S/N'}</span>
                            <Badge variant="success" className="mt-1.5">EJECUTADO</Badge>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                        {/* Group 1: Empresa Context */}
                        <div className="flex flex-col gap-1">
                            <span className="whitespace-nowrap text-[11px] font-semibold text-primary">EMPRESA / CONTACTO / UBICACIÓN</span>
                            <span className="text-[13px] font-semibold text-primary">{ficha?.nombre_empresa || '—'}</span>
                            <span className="text-xs text-muted-foreground">{ficha?.nombre_contacto || '—'}</span>
                            <div className="mt-1 flex items-center gap-1">
                                <IconMapPin size={12} className="text-muted-foreground" />
                                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">{ficha?.latitud ? `${ficha.latitud}, ${ficha.longitud}` : (ficha?.ma_coordenadas || '—')}</span>
                                {ficha?.referencia_googlemaps && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                        <a href={ficha.referencia_googlemaps} target="_blank" rel="noopener noreferrer">
                                            <IconMapPin size={14} />
                                        </a>
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Group 2: Technical Context */}
                        <div className="flex flex-col gap-1">
                            <span className="whitespace-nowrap text-[11px] font-semibold text-primary">CENTRO / OBJETIVO</span>
                            <span className="text-[13px] font-semibold">{ficha?.nombre_centro || '—'}</span>
                            <span className="text-xs text-muted-foreground">{ficha?.nombre_objetivomuestreo_ma || '—'}</span>
                        </div>

                        {/* Group 3: Operational */}
                        <div className="flex flex-col gap-1">
                            <span className="whitespace-nowrap text-[11px] font-semibold text-primary">DETALLE ACTIVIDAD</span>
                            {isPuntual ? (
                                <div>
                                    <span className="text-[10px] font-semibold text-muted-foreground">FECHA MUESTREO</span>
                                    <span className="block text-xs font-semibold">{parseFechaStr(ficha?.ma_muestreo_fechai)}</span>
                                    <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground" title={procesos?.instalacion?.nombreMuestreador}>{procesos?.instalacion?.nombreMuestreador || '—'}</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-[10px] font-semibold text-muted-foreground">INICIO</span>
                                        <span className="block text-xs font-semibold">{parseFechaStr(ficha?.ma_muestreo_fechai)}</span>
                                        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground" title={procesos?.instalacion?.nombreMuestreador}>{procesos?.instalacion?.nombreMuestreador || '—'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-semibold text-muted-foreground">TÉRMINO</span>
                                        <span className="block text-xs font-semibold">{parseFechaStr(ficha?.ma_muestreo_fechat)}</span>
                                        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground" title={procesos?.retiro?.nombreMuestreador}>{procesos?.retiro?.nombreMuestreador || '—'}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex h-full flex-col items-end justify-center gap-2">
                        {/* Botón Información — abre el HelpCenter */}
                        <Button variant="outline" className="w-full font-semibold" onClick={() => setHelpCenterOpen(true)}>
                            <IconInfoCircle size={14} /> Información
                        </Button>

                        {!(activeModule === 'gem' || activeModule === 'unidades-gem') && (
                            <ProtectedContent permission="MA_COMERCIAL_REMUESTREAR">
                                <Button variant="outline" className="w-full text-[#9c36b5] hover:text-[#9c36b5]" onClick={() => setActiveSubmodule('ma-remuestreo')}>
                                    <IconRefresh size={18} /> Remuestreo
                                </Button>
                            </ProtectedContent>
                        )}
                        <ProtectedContent permission="FI_EXP_MC">
                            <Button
                                className="w-full"
                                variant={isRechazada ? 'destructive' : 'default'}
                                title={isRechazada ? 'Atención: Esta ficha ha sido rechazada' : 'Descargar PDF'}
                                onClick={async () => {
                                    try {
                                        const pdfBlob = await fichaService.downloadPdf(Number(selectedFichaId));
                                        const url = window.URL.createObjectURL(pdfBlob);
                                        const link = document.createElement('a');
                                        const fileName = ficha?.caso_adlab || selectedCorrelativo || `Ficha_${selectedFichaId}`;
                                        link.href = url;
                                        link.setAttribute('download', `${fileName}.pdf`);
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        window.URL.revokeObjectURL(url);
                                    } catch (err) {
                                        console.error('Error downloading PDF:', err);
                                    }
                                }}
                            >
                                <IconDownload size={16} /> Exportar PDF
                            </Button>
                        </ProtectedContent>

                        {/* Realizado por GEM - solo visible para rol GEM MAM PM */}
                        {(activeModule === 'gem' || activeModule === 'unidades-gem') && isGemMamPm && (
                            <div className={cn('w-full rounded-lg border p-2', realizadoGem?.realizado ? 'border-success bg-success/10' : 'border-border')}>
                                <div className="flex flex-col items-center gap-1">
                                    <span className={cn('text-center text-[11px] font-semibold', realizadoGem?.realizado ? 'text-success' : 'text-muted-foreground')}>
                                        Realizado por GEM
                                    </span>
                                    <Switch
                                        checked={realizadoGem?.realizado || false}
                                        disabled={realizadoGem?.realizado || realizadoLoading}
                                        onCheckedChange={() => { if (!realizadoGem?.realizado) setConfirmModalOpen(true); }}
                                    />
                                    {realizadoGem?.realizado && (
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] font-semibold text-success">✓ Confirmado</span>
                                            <span className="text-[10px] text-muted-foreground"><strong>Por:</strong> {realizadoGem.userName}</span>
                                            <span className="text-[10px] text-muted-foreground"><strong>Fecha:</strong> {realizadoGem.fecha}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Modal de confirmación Realizado por GEM + OI */}
            <Dialog
                open={confirmModalOpen}
                onOpenChange={(open) => {
                    if (!open) { setConfirmModalOpen(false); setOiNumero(''); setOiError(''); setGenerarFoma(true); setGenerarCadena(true); }
                }}
            >
                <DialogContent className="max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-warning">
                            <IconAlertTriangle size={18} />
                            Confirmar ingreso en ADL Soft
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-6">
                        {/* Texto explicativo */}
                        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3.5 text-warning">
                            <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
                            <div className="text-[13px]">
                                <p className="m-0">
                                    Estás a punto de marcar como <strong>Realizado por GEM</strong> este muestreo.
                                    Esto significa que la información ya fue ingresada <strong>correctamente</strong> en el sistema{' '}
                                    <strong>ADL Soft</strong>.
                                </p>
                                <p className="m-0 mt-2">
                                    Si es así, ingresa el <strong>ID de caso</strong> generado por ADL Soft:
                                </p>
                            </div>
                        </div>

                        {/* Input OI */}
                        <div>
                            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Código de caso (ADL Soft)</span>
                            <div className="flex items-start">
                                {/* Prefijo fijo */}
                                <div className="flex h-9 select-none items-center whitespace-nowrap rounded-l-md border border-r-0 border-border bg-muted px-3 text-[15px] font-extrabold tracking-wide text-primary">
                                    OI-
                                </div>
                                {/* Input numérico */}
                                <Input
                                    placeholder="ingrese el id"
                                    value={oiNumero}
                                    onChange={(e) => {
                                        setOiError('');
                                        setOiNumero(e.target.value.replace(/\D/g, ''));
                                    }}
                                    className={cn('flex-1 rounded-l-none text-[15px] font-bold tracking-wide', oiError && 'border-destructive')}
                                    maxLength={7}
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter' && oiNumero.trim()) handleConfirmRealizado(); }}
                                />
                            </div>
                            {oiError && <span className="mt-1 block text-[11px] text-destructive">{oiError}</span>}
                            {/* Preview */}
                            {oiNumero.trim() && !oiError && (
                                <span className="mt-1.5 block text-xs font-semibold text-primary">
                                    Resultado: <strong>OI-{oiNumero.trim()}</strong>
                                </span>
                            )}
                        </div>

                        <div>
                            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Regenerar documentos con este Caso</span>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-start gap-2">
                                    <Switch checked={generarFoma} onCheckedChange={setGenerarFoma} />
                                    <div>
                                        <span className="block text-[13px]">Generar FoMa</span>
                                        <span className="text-[11px] text-muted-foreground">Reemplaza el encabezado 'Folio' por 'ID CASO' en el FoMa ya generado por la app móvil.</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Switch checked={generarCadena} onCheckedChange={setGenerarCadena} />
                                    <div>
                                        <span className="block text-[13px]">Generar Cadena de Custodia</span>
                                        <span className="text-[11px] text-muted-foreground">Regenera todas las Cadenas de Custodia ya generadas (una por laboratorio) con el nuevo encabezado.</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-border" />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            disabled={realizadoLoading}
                            onClick={() => { setConfirmModalOpen(false); setOiNumero(''); setOiError(''); setGenerarFoma(true); setGenerarCadena(true); }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            className="bg-[#0c8599] text-white hover:bg-[#0c8599]/90"
                            disabled={realizadoLoading || !oiNumero.trim()}
                            onClick={handleConfirmRealizado}
                        >
                            {realizadoLoading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            <IconCheck size={16} /> Confirmar y Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Tabs defaultValue="datos_ingresados" className="w-full">
                <TabsList>
                    <TabsTrigger value="datos_ingresados" className="gap-1.5">
                        <IconDatabase size={16} /> Datos ingresados
                    </TabsTrigger>
                    <TabsTrigger value="documentos" className="gap-1.5">
                        <IconFileText size={16} /> Documentos
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="datos_ingresados" className="mt-4">
                    <Card className="w-full overflow-hidden p-0">
                        <Tabs defaultValue="equipos" className="w-full px-4">
                            <TabsList>
                                <TabsTrigger value="equipos" className="gap-1.5">
                                    <IconTool size={16} /> Equipos
                                </TabsTrigger>
                                <TabsTrigger value="datos" className="gap-1.5">
                                    <IconCalendarTime size={16} /> Datos
                                </TabsTrigger>
                                <TabsTrigger value="analisis" className="gap-1.5">
                                    <IconFlask size={16} /> Análisis
                                </TabsTrigger>
                                <TabsTrigger value="fotos" className="gap-1.5">
                                    <IconPhoto size={16} /> Fotos
                                </TabsTrigger>
                                <TabsTrigger value="firmas" className="gap-1.5">
                                    <IconSignature size={16} /> Firmas
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="equipos" className="mt-0">
                                <div className="p-4">
                                    {isPuntual ? (
                                        <div>
                                            <div className="mb-4 flex items-center gap-2">
                                                <IconTool className="text-[#e8590c]" size={20} />
                                                <h5 className="m-0 text-base font-semibold">Equipos Utilizados</h5>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {equiposInstUsados.length > 0 ? (
                                                    equiposInstUsados.map((eq: any, i: number) => (
                                                        <div key={i} className="rounded-md border border-border p-2">
                                                            <span className="block text-[13px] font-semibold">{eq.nombre}</span>
                                                            <span className="text-xs text-muted-foreground">Código: {eq.codigo}</span>
                                                        </div>
                                                    ))
                                                ) : <span className="text-[13px] italic text-muted-foreground">No hay equipos registrados.</span>}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                                            <div>
                                                <div className="mb-4 flex items-center gap-2">
                                                    <IconTool className="text-[#e8590c]" size={20} />
                                                    <h5 className="m-0 text-base font-semibold">Equipos Instalación</h5>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    {equiposInstalacion.length > 0 ? (
                                                        equiposInstalacion.map((eq: any, i: number) => (
                                                            <div key={i} className="rounded-md border border-border p-2">
                                                                <span className="block text-[13px] font-semibold">{eq.nombre}</span>
                                                                <span className="text-xs text-muted-foreground">Código: {eq.codigo}</span>
                                                            </div>
                                                        ))
                                                    ) : <span className="text-[13px] italic text-muted-foreground">No hay equipos registrados.</span>}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="mb-4 flex items-center gap-2">
                                                    <IconTool className="text-[#1c7ed6]" size={20} />
                                                    <h5 className="m-0 text-base font-semibold">Equipos Retiro</h5>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    {equiposRetiro.length > 0 ? (
                                                        equiposRetiro.map((eq: any, i: number) => (
                                                            <div key={i} className="rounded-md border border-border p-2">
                                                                <span className="block text-[13px] font-semibold">{eq.nombre}</span>
                                                                <span className="text-xs text-muted-foreground">Código: {eq.codigo}</span>
                                                            </div>
                                                        ))
                                                    ) : <span className="text-[13px] italic text-muted-foreground">No hay equipos registrados.</span>}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="my-6 flex items-center gap-3">
                                        <hr className="flex-1 border-t border-border" />
                                        <span className="text-xs text-muted-foreground">Condiciones de Medición</span>
                                        <hr className="flex-1 border-t border-border" />
                                    </div>
                                    <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                                        <div>
                                            <span className="block text-[11px] font-semibold text-muted-foreground">FLUJO LAMINAR</span>
                                            <Badge variant={procesos?.instalacion?.condiciones?.flujoLaminar === 'S' ? 'success' : 'outline'}>
                                                {procesos?.instalacion?.condiciones?.flujoLaminar === 'S' ? 'SÍ' : 'NO'}
                                            </Badge>
                                        </div>
                                        <div>
                                            <span className="block text-[11px] font-semibold text-muted-foreground">VELOCIDAD UNIFORME</span>
                                            <Badge variant={procesos?.instalacion?.condiciones?.velUniforme === 'S' ? 'success' : 'outline'}>
                                                {procesos?.instalacion?.condiciones?.velUniforme === 'S' ? 'SÍ' : 'NO'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <span className="mt-4 block text-[11px] font-semibold text-muted-foreground">OBSERVACIONES TÉCNICAS</span>
                                    <span className="text-[13px] italic text-muted-foreground">{procesos?.instalacion?.condiciones?.observaciones || 'Sin observaciones.'}</span>
                                </div>
                            </TabsContent>

                            <TabsContent value="datos" className="mt-0">
                                <div className="p-4">
                                    <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                                        {isPuntual ? (
                                            <div style={{ maxWidth: 360 }}>
                                                <h5 className="mb-2 text-base font-semibold text-[#e8590c]">Muestreo</h5>
                                                <div className="rounded-lg border border-border p-4">
                                                    <div className="flex flex-col gap-2">
                                                        <KV label="Fecha Muestreo" value={parseFechaStr(ficha?.ma_muestreo_fechai)} />
                                                        <KV label="Hora Muestreo" value={fmt(ficha?.ma_muestreo_horai)} />
                                                        <KV label="Temperatura" value={`${fmt(ficha?.ma_temperaturai)} °C`} color="#d9480f" />
                                                        <KV label="Temperatura corregida" value={`${fmt(ficha?.temperatura_corregidai)} °C`} color="#d9480f" />
                                                        <KV label="pH" value={fmt(ficha?.ma_phi)} color="#d9480f" />
                                                        {ficha?.totalizador_inicio && <KV label="Totalizador Inicio" value={`${fmt(ficha?.totalizador_inicio)} m³`} />}
                                                        {ficha?.totalizador_final && <KV label="Totalizador Término" value={`${fmt(ficha?.totalizador_final)} m³`} />}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div>
                                                    <h5 className="mb-2 text-base font-semibold text-[#e8590c]">Instalación</h5>
                                                    <div className="rounded-lg border border-border p-4">
                                                        <div className="flex flex-col gap-2">
                                                            <KV label="Fecha Inicio" value={parseFechaStr(ficha?.ma_muestreo_fechai)} />
                                                            <KV label="Hora Inicio" value={fmt(ficha?.ma_muestreo_horai)} />
                                                            <KV label="Temp. Inicio" value={`${fmt(ficha?.ma_temperaturai)} °C`} color="#d9480f" />
                                                            <KV label="Temp. Inicio corregida" value={`${fmt(ficha?.temperatura_corregidai)} °C`} color="#d9480f" />
                                                            <KV label="pH Inicio" value={fmt(ficha?.ma_phi)} color="#d9480f" />
                                                            {ficha?.totalizador_inicio && <KV label="Totalizador Inicio" value={`${fmt(ficha?.totalizador_inicio)} m³`} />}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h5 className="mb-2 text-base font-semibold text-primary">Retiro</h5>
                                                    <div className="rounded-lg border border-border p-4">
                                                        <div className="flex flex-col gap-2">
                                                            <KV label="Fecha Término" value={parseFechaStr(ficha?.ma_muestreo_fechat)} />
                                                            <KV label="Hora Término" value={fmt(ficha?.ma_muestreo_horat)} />
                                                            <KV label="Temp. Término" value={`${fmt(ficha?.ma_temperaturat)} °C`} color="#1864ab" />
                                                            <KV label="Temp. Término corregida" value={`${fmt(ficha?.temperatura_corregidat)} °C`} color="#1864ab" />
                                                            <KV label="pH Término" value={fmt(ficha?.ma_pht)} color="#1864ab" />
                                                            {ficha?.totalizador_final && <KV label="Totalizador Final" value={`${fmt(ficha?.totalizador_final)} m³`} />}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* Datos Compuestos / VDD */}
                                        {ficha?.tipo_fichaingresoservicio !== 'Puntual' && (
                                            <div>
                                                <h5 className="mb-2 text-base font-semibold text-[#0c8599]">Datos Compuestos / VDD</h5>
                                                <div className="rounded-lg border border-border p-4">
                                                    <div className="flex flex-col gap-2">
                                                        <KV label="Fecha Compuesta" value={parseFechaStr(ficha?.ma_fecha_compuesta)} />
                                                        <KV label="Hora Compuesta" value={fmt(ficha?.ma_hora_compuesta)} />
                                                        <KV label="Temp. Compuesta" value={`${fmt(ficha?.ma_temperatura_compuesta)} °C`} color="#0c8599" />
                                                        <KV label="Temp. Compuesta corregida" value={`${fmt(ficha?.temperatura_corregidacompuesta)} °C`} color="#0c8599" />
                                                        <KV label="pH Compuesto" value={fmt(ficha?.ma_ph_compuesta)} color="#0c8599" />
                                                        <div className="flex justify-between">
                                                            <span className="text-[13px] font-semibold text-muted-foreground">VDD</span>
                                                            <span className="text-[15px] font-semibold text-primary">{fmt(ficha?.vdd)} m³/h</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="analisis" className="mt-0">
                                <div className="p-4">
                                    <div className="flex flex-col gap-6">
                                        {/* Análisis de Terreno */}
                                        <div>
                                            <div className="mb-4 flex items-center gap-2">
                                                <IconTool className="text-[#0c8599]" size={20} />
                                                <h5 className="m-0 text-base font-semibold">Análisis de Terreno</h5>
                                            </div>
                                            <div className="overflow-auto rounded-lg border border-border">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-[#0c8599]/5 hover:bg-[#0c8599]/5">
                                                            <TableHead>Parámetro</TableHead>
                                                            <TableHead className="text-center">Valor</TableHead>
                                                            {showUf && <TableHead className="text-center">UF</TableHead>}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {analisisTerreno.map((item: any, i: number) => (
                                                            <TableRow key={i}>
                                                                <TableCell className="font-semibold">{item.parametro}</TableCell>
                                                                <TableCell className="text-center"><Badge variant="outline">{item.valor}</Badge></TableCell>
                                                                {showUf && (
                                                                    <TableCell className="text-center font-semibold">{item.uf_individual > 0 ? Number(item.uf_individual).toFixed(2) : '—'}</TableCell>
                                                                )}
                                                            </TableRow>
                                                        ))}
                                                        {analisisTerreno.length === 0 && (
                                                            <TableRow>
                                                                <TableCell colSpan={showUf ? 3 : 2} className="text-center">
                                                                    <span className="text-[13px] italic text-muted-foreground">No hay parámetros de terreno registrados.</span>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>

                                        {/* Análisis de Laboratorio */}
                                        <div>
                                            <div className="mb-4 flex items-center gap-2">
                                                <IconFlask className="text-[#1c7ed6]" size={20} />
                                                <h5 className="m-0 text-base font-semibold">Análisis de Laboratorio</h5>
                                            </div>
                                            <div className="overflow-auto rounded-lg border border-border">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-primary/5 hover:bg-primary/5">
                                                            <TableHead>Parámetro</TableHead>
                                                            <TableHead>Laboratorio Asignado</TableHead>
                                                            {showUf && <TableHead className="text-center">UF</TableHead>}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {analisisLaboratorio.map((item: any, i: number) => (
                                                            <TableRow key={i}>
                                                                <TableCell className="font-semibold">{item.parametro}</TableCell>
                                                                <TableCell>
                                                                    <span className="text-xs" style={{ color: item.id_laboratorioensayo_2 > 0 ? '#d9480f' : '#1864ab' }}>
                                                                        {item.nombre_laboratorioensayo || '—'}
                                                                    </span>
                                                                </TableCell>
                                                                {showUf && (
                                                                    <TableCell className="text-center font-semibold">{item.uf_individual > 0 ? Number(item.uf_individual).toFixed(2) : '—'}</TableCell>
                                                                )}
                                                            </TableRow>
                                                        ))}
                                                        {analisisLaboratorio.length === 0 && (
                                                            <TableRow>
                                                                <TableCell colSpan={showUf ? 3 : 2} className="text-center">
                                                                    <span className="text-[13px] italic text-muted-foreground">No hay parámetros de laboratorio registrados.</span>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="fotos" className="mt-0">
                                <div className="p-4">
                                    {isPuntual ? (
                                        <div>
                                            <div className="mb-4 flex items-center gap-2">
                                                <IconPhoto className="text-[#e8590c]" size={20} />
                                                <h5 className="m-0 text-base font-semibold">Fotos Muestreo</h5>
                                            </div>
                                            <div className="rounded-lg border border-border p-4">
                                                <PhotoGrid
                                                    photos={fotosPuntual}
                                                    emptyText="No hay fotos de muestreo."
                                                    onOpen={setOpenedImage}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-6">
                                            <div>
                                                <div className="mb-4 flex items-center gap-2">
                                                    <IconPhoto className="text-[#e8590c]" size={20} />
                                                    <h5 className="m-0 text-base font-semibold">Fotos Instalación</h5>
                                                </div>
                                                <div className="rounded-lg border border-border p-4">
                                                    <PhotoGrid
                                                        photos={fotosInstalacion}
                                                        emptyText="No hay fotos de instalación."
                                                        onOpen={setOpenedImage}
                                                    />
                                                </div>
                                            </div>
                                            <hr className="border-t border-border" />
                                            <div>
                                                <div className="mb-4 flex items-center gap-2">
                                                    <IconPhoto className="text-[#1c7ed6]" size={20} />
                                                    <h5 className="m-0 text-base font-semibold">Fotos Retiro</h5>
                                                </div>
                                                <div className="rounded-lg border border-border p-4">
                                                    <PhotoGrid
                                                        photos={fotosRetiro}
                                                        emptyText="No hay fotos de retiro."
                                                        onOpen={setOpenedImage}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="firmas" className="mt-0">
                                <div className="p-4">
                                    {isPuntual ? (
                                        <FirmasBloque proceso={procesos?.instalacion} nombreOrigen="instalacion" />
                                    ) : (
                                        <Tabs defaultValue="instalacion_f" className="w-full">
                                            <div className="flex justify-center">
                                                <TabsList>
                                                    <TabsTrigger value="instalacion_f">Instalación</TabsTrigger>
                                                    <TabsTrigger value="retiro_f">Retiro</TabsTrigger>
                                                </TabsList>
                                            </div>
                                            <TabsContent value="instalacion_f">
                                                <FirmasBloque proceso={procesos?.instalacion} nombreOrigen="instalacion" />
                                            </TabsContent>
                                            <TabsContent value="retiro_f">
                                                <FirmasBloque proceso={procesos?.retiro} nombreOrigen="retiro" />
                                            </TabsContent>
                                        </Tabs>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </Card>
                </TabsContent>

                <TabsContent value="documentos" className="mt-4">
                    <Card className="w-full p-5">
                        <div className="flex flex-col gap-6">
                            <div>
                                <h4 className="m-0 text-lg font-semibold text-primary">Documentos de Respaldo</h4>
                                <span className="text-xs text-muted-foreground">Archivos PDF generados para el cliente y laboratorios</span>
                            </div>

                            {media?.documentos && media.documentos.length > 0 ? (
                                <div className="flex flex-col gap-6">
                                    {/* FoMa Group */}
                                    {media.documentos.filter((d: any) => d.tipo === 'FoMa').length > 0 && (
                                        <div>
                                            <SectionDivider label="FOMA" />
                                            <div className="flex flex-col gap-2">
                                                {media.documentos.filter((d: any) => d.tipo === 'FoMa').map((doc: any, index: number) => (
                                                    <Card key={`foma-${index}`} className="p-3">
                                                        <div className="flex flex-nowrap justify-between">
                                                            <div className="flex flex-nowrap items-center gap-2">
                                                                <IconWrap color="#e03131" bg="rgba(224,49,49,0.1)"><IconFileText size={18} /></IconWrap>
                                                                <div>
                                                                    <span className="block text-[13px] font-semibold">{doc.label}</span>
                                                                    <span className="text-xs text-muted-foreground">{doc.nombre}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button size="sm" variant="outline" onClick={() => window.open(`${apiClient.defaults.baseURL}${doc.ruta}`, '_blank')}>
                                                                    <IconExternalLink size={12} /> Abrir
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="text-[#2f9e44] hover:text-[#2f9e44]"
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc); setResendSuccess(false); setResendTo(user?.email || ''); setResendCc(''); setResendModalOpen(true); }}
                                                                >
                                                                    <IconSend size={12} /> Reenviar
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleDownload(`${apiClient.defaults.baseURL}${doc.ruta}`, doc.nombre)}
                                                                >
                                                                    <IconDownload size={12} /> Descargar
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Cadena de Custodia Group */}
                                    {media.documentos.filter((d: any) => d.tipo === 'Cadena de Custodia').length > 0 && (
                                        <div>
                                            <SectionDivider label="CADENAS DE CUSTODIA" />
                                            <div className="flex flex-col gap-2">
                                                {media.documentos.filter((d: any) => d.tipo === 'Cadena de Custodia').map((doc: any, index: number) => {
                                                    const isExpanded = expandedDocs.includes(doc.nombre);
                                                    const labTests = analisis?.filter((a: any) =>
                                                        a.tipo_analisis === 'Laboratorio' &&
                                                        doc.label && a.nombre_laboratorioensayo &&
                                                        (a.nombre_laboratorioensayo.toLowerCase().includes(doc.label.toLowerCase()) ||
                                                            doc.label.toLowerCase().includes(a.nombre_laboratorioensayo.toLowerCase()))
                                                    ) || [];

                                                    return (
                                                        <Card key={`cadena-${index}`} className="overflow-hidden p-0">
                                                            <div className="cursor-pointer p-2" onClick={() => toggleDoc(doc.nombre)}>
                                                                <div className="flex flex-nowrap justify-between">
                                                                    <div className="flex flex-nowrap items-center gap-2">
                                                                        <IconWrap color="#1864ab" bg="rgba(22,119,255,0.1)"><IconFileText size={18} /></IconWrap>
                                                                        <div>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-[13px] font-semibold">{doc.label}</span>
                                                                                {isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                                                                            </div>
                                                                            <span className="text-xs text-muted-foreground">{doc.nombre}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); window.open(`${apiClient.defaults.baseURL}${doc.ruta}`, '_blank'); }}>
                                                                            <IconExternalLink size={12} /> Abrir
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="text-[#2f9e44] hover:text-[#2f9e44]"
                                                                            onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc); setResendSuccess(false); setResendTo(user?.email || ''); setResendCc(''); setResendModalOpen(true); }}
                                                                        >
                                                                            <IconSend size={12} /> Reenviar
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={(e) => { e.stopPropagation(); handleDownload(`${apiClient.defaults.baseURL}${doc.ruta}`, doc.nombre); }}
                                                                        >
                                                                            <IconDownload size={12} /> Descargar
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {isExpanded && (
                                                                <div className="border-t border-border bg-muted/40 p-4">
                                                                    <span className="mb-2 block text-[11px] font-semibold text-muted-foreground">ANÁLISIS ASOCIADOS A ESTA CADENA:</span>
                                                                    {labTests.length > 0 ? (
                                                                        <div className="overflow-hidden rounded-md border border-border bg-card">
                                                                            <Table>
                                                                                <TableHeader>
                                                                                    <TableRow><TableHead>Parámetro</TableHead></TableRow>
                                                                                </TableHeader>
                                                                                <TableBody>
                                                                                    {labTests.map((t: any, idx: number) => (
                                                                                        <TableRow key={idx}><TableCell>{t.parametro}</TableCell></TableRow>
                                                                                    ))}
                                                                                </TableBody>
                                                                            </Table>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs italic text-muted-foreground">No se pudieron vincular análisis automáticamente por nombre.</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 py-8">
                                    <IconFileText size={40} className="text-muted-foreground" />
                                    <span className="text-muted-foreground">No se encontraron documentos (FoMa/Cadenas) en la carpeta del correlativo.</span>
                                </div>
                            )}
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={!!openedImage} onOpenChange={(open) => { if (!open) setOpenedImage(null); }}>
                <DialogContent className="max-w-[80vw] p-0">
                    {openedImage && (
                        <img
                            src={openedImage}
                            className="max-h-[90vh] w-full object-contain"
                            alt=""
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={resendModalOpen} onOpenChange={setResendModalOpen}>
                <DialogContent className="max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-primary">
                            <IconWrap color="#1864ab" bg="rgba(22,119,255,0.1)" size={28}><IconSend size={16} /></IconWrap>
                            Gestión de Reenvío de Documentos
                        </DialogTitle>
                    </DialogHeader>
                    {selectedDocument && (
                        <div className="flex flex-col gap-4">
                            {resendSuccess ? (
                                <div className="flex flex-col items-center gap-4 py-8">
                                    <IconWrap color="#2f9e44" bg="rgba(47,158,68,0.15)" size={80}><IconCheck size={40} /></IconWrap>
                                    <h3 className="m-0 text-center text-xl font-semibold">¡Documento Enviado!</h3>
                                    <span className="text-center text-muted-foreground">El documento ha sido despachado exitosamente.</span>
                                    <Button variant="outline" className="mt-4" onClick={() => setResendModalOpen(false)}>
                                        Cerrar y volver a la ficha
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-primary">
                                        <IconMailForward size={16} className="mt-0.5 shrink-0" />
                                        <span className="text-[13px]">Está preparando el envío de: <b>{selectedDocument.label}</b> ({selectedDocument.tipo || 'Documento'})</span>
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        <div>
                                            <span className="mb-1 block text-[13px] font-semibold">Para (To)</span>
                                            <Input
                                                placeholder="correo@ejemplo.com"
                                                value={resendTo}
                                                onChange={(e) => setResendTo(e.target.value)}
                                                disabled // Temporary for testing phase
                                            />
                                            <span className="text-[11px] text-muted-foreground">Destinatario bloqueado en fase de pruebas.</span>
                                        </div>
                                        <div>
                                            <span className="mb-1 block text-[13px] font-semibold">Copia (CC)</span>
                                            <Input
                                                placeholder="copia@ejemplo.com"
                                                value={resendCc}
                                                onChange={(e) => setResendCc(e.target.value)}
                                            />
                                            <span className="text-[11px] text-muted-foreground">Separar multiplicidad con comas.</span>
                                        </div>

                                        <Card className="bg-muted/40 p-3">
                                            <div className="flex flex-nowrap items-center gap-2">
                                                <IconWrap color="#e03131" bg="rgba(224,49,49,0.1)" size={36}><IconFileText size={20} /></IconWrap>
                                                <div className="min-w-0 flex-1">
                                                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">Archivo Adjunto</span>
                                                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">
                                                        {selectedDocument.nombre || 'Documento.pdf'}
                                                    </span>
                                                </div>
                                            </div>
                                        </Card>

                                        {resendError && <WorkflowAlert type="error" title="Error de envío" message={resendError} />}

                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" disabled={resendLoading} onClick={() => setResendModalOpen(false)}>Cancelar</Button>
                                            <Button
                                                className="bg-[#2f9e44] text-white hover:bg-[#2f9e44]/90"
                                                disabled={resendLoading}
                                                onClick={handleResend}
                                            >
                                                {resendLoading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                                                <IconSend size={16} /> Enviar Correo
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

function IconWrap({ children, color, bg, size = 24 }: { children: React.ReactNode; color: string; bg: string; size?: number }) {
    return (
        <div
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{ width: size, height: size, backgroundColor: bg, color }}
        >
            {children}
        </div>
    );
}

function SectionDivider({ label }: { label: string }) {
    return (
        <div className="mb-4 flex items-center gap-3">
            <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
            <hr className="flex-1 border-t border-border" />
        </div>
    );
}

function PhotoGrid({ photos, emptyText, onOpen }: { photos?: string[]; emptyText: string; onOpen: (url: string) => void }) {
    if (!photos || photos.length === 0) {
        return <span className="text-[13px] italic text-muted-foreground">{emptyText}</span>;
    }
    return (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {photos.map((photo, idx) => {
                const url = `${apiClient.defaults.baseURL}${photo}`;
                return (
                    <Card key={idx} className="cursor-pointer p-1 transition-shadow hover:shadow-md" onClick={() => onOpen(url)}>
                        <img
                            src={url}
                            className="h-[140px] w-full rounded object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x300?text=Sin+Imagen'; }}
                            alt=""
                        />
                    </Card>
                );
            })}
        </div>
    );
}

function FirmasBloque({ proceso, nombreOrigen }: { proceso: any; nombreOrigen: string }) {
    const firmaMuestreador = proceso?.firmas?.find((f: any) => f.rol === 'muestreador');
    const firmaObservador = proceso?.firmas?.find((f: any) => f.rol === 'observador');
    const tieneObservador = proceso?.nombreObservador && proceso?.nombreObservador !== 'S/D';

    return (
        <div className="flex flex-col gap-6">
            <Card className="p-5">
                <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                    <div>
                        <span className="mb-1 block text-xs font-semibold text-muted-foreground">MUESTREADOR</span>
                        <span className="text-base font-semibold">{proceso?.nombreMuestreador || '—'}</span>
                        <div className="mt-4 flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 p-2">
                            {firmaMuestreador ? (
                                <img src={`${apiClient.defaults.baseURL}${firmaMuestreador.ruta}`} className="h-[100px] object-contain" alt={`Firma muestreador ${nombreOrigen}`} />
                            ) : <span className="text-xs italic text-muted-foreground">Sin firma registrada.</span>}
                        </div>
                    </div>
                    <div>
                        <span className="mb-1 block text-xs font-semibold text-muted-foreground">OBSERVACIONES MUESTREADOR</span>
                        <div className="h-40 overflow-y-auto rounded-lg bg-muted/40 p-4">
                            <span className="text-[13px] italic">
                                {proceso?.observaciones || 'Sin observaciones.'}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>

            <SectionDivider label="Observador de terreno" />

            {tieneObservador ? (
                <Card className="p-5">
                    <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                        <div>
                            <span className="mb-1 block text-xs font-semibold text-muted-foreground">NOMBRE OBSERVADOR</span>
                            <span className="text-sm font-semibold">{proceso.nombreObservador}</span>
                            <span className="mb-1 mt-4 block text-xs font-semibold text-muted-foreground">CARGO</span>
                            <span className="text-[13px]">{proceso.cargoObservador || '—'}</span>
                        </div>
                        <div>
                            <span className="mb-1 block text-xs font-semibold text-muted-foreground">FIRMA OBSERVADOR</span>
                            <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 p-2">
                                {firmaObservador ? (
                                    <img src={`${apiClient.defaults.baseURL}${firmaObservador.ruta}`} className="h-[100px] object-contain" alt={`Firma observador ${nombreOrigen}`} />
                                ) : <span className="text-xs italic text-muted-foreground">Sin firma registrada.</span>}
                            </div>
                        </div>
                    </div>
                </Card>
            ) : (
                <WorkflowAlert type="info" title="Observador de terreno no registrado en el proceso" message="No se registró un observador de terreno para este proceso." />
            )}
        </div>
    );
}
