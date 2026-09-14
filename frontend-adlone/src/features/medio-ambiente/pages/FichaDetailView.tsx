import { useEffect, useState } from 'react';
import { fichaService } from '../services/ficha.service';
import {
    Typography,
    Tag,
    Tabs,
    Button,
    Alert,
    Card,
    Modal,
    Input,
    Tooltip,
    Switch,
    Spin
} from 'antd';
import {
    IconArrowLeft,
    IconDatabase,
    IconTool,
    IconPhoto,
    IconSignature,
    IconCalendarTime,
    IconMapPin,
    IconAlertCircle,
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

const { Text, Title } = Typography;

// El backend (mssql) devuelve los datetime guardados con GETDATE() (hora local del servidor)
// como si fueran UTC. Usamos los componentes UTC para evitar que el navegador
// reste el offset horario nuevamente.
const formatFechaHoraServidor = (value: string | Date) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

function Th({ children, center = false }: { children?: React.ReactNode; center?: boolean }) {
    return (
        <th style={{ textAlign: center ? 'center' : 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--app-text-secondary)', borderBottom: '1px solid var(--app-border)' }}>
            {children}
        </th>
    );
}
function Td({ children, center = false, bold = false, colSpan }: { children?: React.ReactNode; center?: boolean; bold?: boolean; colSpan?: number }) {
    return (
        <td colSpan={colSpan} style={{ textAlign: center ? 'center' : 'left', padding: '8px 12px', fontSize: 13, fontWeight: bold ? 600 : 400, borderBottom: '1px solid var(--app-border)' }}>
            {children}
        </td>
    );
}

function KV({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>{label}</Text>
            <Text strong style={{ fontSize: 13, color }}>{value}</Text>
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
            <div style={{ padding: 32, width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, height: '50vh' }}>
                    <Spin size="large" />
                    <Text style={{ fontSize: 16 }}>Cargando detalles de la ejecución...</Text>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{ padding: 32, width: '100%' }}>
                <Alert type="error" showIcon icon={<IconAlertCircle size={16} />} message="Error" description={error || 'No se pudo cargar la información'} />
                <Button icon={<IconArrowLeft size={16} />} style={{ marginTop: 16 }} onClick={handleBack}>
                    Volver
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

    return (
        <div style={{ padding: 16, width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>

            {/* Header */}
            <Card style={{ marginBottom: 16, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '3fr 7fr 2fr', gap: 24, alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <Button type="text" shape="circle" icon={<IconArrowLeft size={20} />} onClick={handleBack} style={{ marginTop: 5 }} />
                        <div>
                            <Title level={2} style={{ margin: 0, lineHeight: 1.2, color: '#1864ab' }}>{ficha?.caso_adlab || 'Caso S/N'}</Title>
                            <Text type="secondary" strong style={{ fontSize: 12, display: 'block', marginTop: 4 }}>{ficha?.frecuencia_correlativo || 'Correlativo S/N'}</Text>
                            <Tag color="green" style={{ marginTop: 6 }}>EJECUTADO</Tag>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                        {/* Group 1: Empresa Context */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <Text strong style={{ fontSize: 11, color: '#1864ab', whiteSpace: 'nowrap' }}>EMPRESA / CONTACTO / UBICACIÓN</Text>
                            <Text strong style={{ fontSize: 13, color: '#1864ab' }}>{ficha?.nombre_empresa || '—'}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>{ficha?.nombre_contacto || '—'}</Text>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
                                <IconMapPin size={12} color="gray" />
                                <Text type="secondary" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ficha?.latitud ? `${ficha.latitud}, ${ficha.longitud}` : (ficha?.ma_coordenadas || '—')}</Text>
                                {ficha?.referencia_googlemaps && (
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<IconMapPin size={14} />}
                                        href={ficha.referencia_googlemaps}
                                        target="_blank"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Group 2: Technical Context */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <Text strong style={{ fontSize: 11, color: '#1864ab', whiteSpace: 'nowrap' }}>CENTRO / OBJETIVO</Text>
                            <Text strong style={{ fontSize: 13 }}>{ficha?.nombre_centro || '—'}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>{ficha?.nombre_objetivomuestreo_ma || '—'}</Text>
                        </div>

                        {/* Group 3: Operational */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <Text strong style={{ fontSize: 11, color: '#1864ab', whiteSpace: 'nowrap' }}>DETALLE ACTIVIDAD</Text>
                            {isPuntual ? (
                                <div>
                                    <Text type="secondary" strong style={{ fontSize: 10 }}>FECHA MUESTREO</Text>
                                    <Text strong style={{ fontSize: 12, display: 'block' }}>{parseFechaStr(ficha?.ma_muestreo_fechai)}</Text>
                                    <Text type="secondary" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={procesos?.instalacion?.nombreMuestreador}>{procesos?.instalacion?.nombreMuestreador || '—'}</Text>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <div>
                                        <Text type="secondary" strong style={{ fontSize: 10 }}>INICIO</Text>
                                        <Text strong style={{ fontSize: 12, display: 'block' }}>{parseFechaStr(ficha?.ma_muestreo_fechai)}</Text>
                                        <Text type="secondary" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={procesos?.instalacion?.nombreMuestreador}>{procesos?.instalacion?.nombreMuestreador || '—'}</Text>
                                    </div>
                                    <div>
                                        <Text type="secondary" strong style={{ fontSize: 10 }}>TÉRMINO</Text>
                                        <Text strong style={{ fontSize: 12, display: 'block' }}>{parseFechaStr(ficha?.ma_muestreo_fechat)}</Text>
                                        <Text type="secondary" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={procesos?.retiro?.nombreMuestreador}>{procesos?.retiro?.nombreMuestreador || '—'}</Text>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', justifyContent: 'center', height: '100%' }}>
                        {/* Botón Información — abre el HelpCenter */}
                        <Button
                            block
                            icon={<IconInfoCircle size={14} />}
                            onClick={() => setHelpCenterOpen(true)}
                            style={{ fontWeight: 600 }}
                        >
                            Información
                        </Button>

                        {!(activeModule === 'gem' || activeModule === 'unidades-gem') && (
                            <ProtectedContent permission="MA_COMERCIAL_REMUESTREAR">
                                <Button
                                    block
                                    style={{ color: '#9c36b5' }}
                                    icon={<IconRefresh size={18} />}
                                    onClick={() => setActiveSubmodule('ma-remuestreo')}
                                >
                                    Remuestreo
                                </Button>
                            </ProtectedContent>
                        )}
                        <ProtectedContent permission="FI_EXP_MC">
                            <Tooltip
                                title={isRechazada ? 'Atención: Esta ficha ha sido rechazada' : 'Descargar PDF'}
                            >
                                <Button
                                    block
                                    icon={<IconDownload size={16} />}
                                    type="primary"
                                    danger={isRechazada}
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
                                    Exportar PDF
                                </Button>
                            </Tooltip>
                        </ProtectedContent>

                        {/* Realizado por GEM - solo visible para rol GEM MAM PM */}
                        {(activeModule === 'gem' || activeModule === 'unidades-gem') && isGemMamPm && (
                            <div style={{
                                width: '100%', border: `1px solid ${realizadoGem?.realizado ? '#38d9a9' : 'var(--app-border)'}`, borderRadius: 8, padding: 8,
                                background: realizadoGem?.realizado ? 'rgba(34,197,94,0.07)' : undefined,
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <Text strong style={{ fontSize: 11, color: realizadoGem?.realizado ? '#0c8599' : 'var(--app-text-secondary)', textAlign: 'center' }}>
                                        Realizado por GEM
                                    </Text>
                                    <Switch
                                        checked={realizadoGem?.realizado || false}
                                        disabled={realizadoGem?.realizado || realizadoLoading}
                                        onChange={() => { if (!realizadoGem?.realizado) setConfirmModalOpen(true); }}
                                    />
                                    {realizadoGem?.realizado && (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <Text strong style={{ fontSize: 10, color: '#0c8599' }}>✓ Confirmado</Text>
                                            <Text type="secondary" style={{ fontSize: 10 }}><strong>Por:</strong> {realizadoGem.userName}</Text>
                                            <Text type="secondary" style={{ fontSize: 10 }}><strong>Fecha:</strong> {realizadoGem.fecha}</Text>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Modal de confirmación Realizado por GEM + OI */}
            <Modal
                open={confirmModalOpen}
                onCancel={() => { setConfirmModalOpen(false); setOiNumero(''); setOiError(''); setGenerarFoma(true); setGenerarCadena(true); }}
                footer={null}
                width={520}
                centered
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconAlertTriangle size={18} color="#e8590c" />
                        <Text strong style={{ fontSize: 15, color: '#d9480f' }}>Confirmar ingreso en ADL Soft</Text>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
                    {/* Texto explicativo */}
                    <Alert
                        type="warning"
                        showIcon
                        icon={<IconAlertTriangle size={16} />}
                        message={
                            <div>
                                <Text style={{ fontSize: 13 }}>
                                    Estás a punto de marcar como <strong>Realizado por GEM</strong> este muestreo.
                                    Esto significa que la información ya fue ingresada <strong>correctamente</strong> en el sistema{' '}
                                    <strong>ADL Soft</strong>.
                                </Text>
                                <Text style={{ fontSize: 13, display: 'block', marginTop: 8 }}>
                                    Si es así, ingresa el <strong>ID de caso</strong> generado por ADL Soft:
                                </Text>
                            </div>
                        }
                    />

                    {/* Input OI */}
                    <div>
                        <Text type="secondary" strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Código de caso (ADL Soft)</Text>
                        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                            {/* Prefijo fijo */}
                            <div
                                style={{
                                    height: 36,
                                    padding: '0 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: 'var(--app-hover-bg)',
                                    border: '1.5px solid var(--app-border)',
                                    borderRight: 'none',
                                    borderRadius: '6px 0 0 6px',
                                    fontWeight: 800,
                                    fontSize: 15,
                                    color: '#1864ab',
                                    letterSpacing: 1,
                                    userSelect: 'none',
                                    whiteSpace: 'nowrap'
                                }}
                            >
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
                                status={oiError ? 'error' : undefined}
                                style={{ flex: 1, borderRadius: '0 6px 6px 0', fontWeight: 700, fontSize: 15, letterSpacing: 1 }}
                                maxLength={7}
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter' && oiNumero.trim()) handleConfirmRealizado(); }}
                            />
                        </div>
                        {oiError && <Text type="danger" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>{oiError}</Text>}
                        {/* Preview */}
                        {oiNumero.trim() && !oiError && (
                            <Text strong style={{ fontSize: 12, color: '#1c7ed6', display: 'block', marginTop: 6 }}>
                                Resultado: <strong>OI-{oiNumero.trim()}</strong>
                            </Text>
                        )}
                    </div>

                    <div>
                        <Text type="secondary" strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Regenerar documentos con este Caso</Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <Switch checked={generarFoma} onChange={(checked) => setGenerarFoma(checked)} />
                                <div>
                                    <Text style={{ fontSize: 13, display: 'block' }}>Generar FoMa</Text>
                                    <Text type="secondary" style={{ fontSize: 11 }}>Reemplaza el encabezado 'Folio' por 'ID CASO' en el FoMa ya generado por la app móvil.</Text>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                <Switch checked={generarCadena} onChange={(checked) => setGenerarCadena(checked)} />
                                <div>
                                    <Text style={{ fontSize: 13, display: 'block' }}>Generar Cadena de Custodia</Text>
                                    <Text type="secondary" style={{ fontSize: 11 }}>Regenera todas las Cadenas de Custodia ya generadas (una por laboratorio) con el nuevo encabezado.</Text>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--app-border)', margin: 0 }} />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button
                            onClick={() => { setConfirmModalOpen(false); setOiNumero(''); setOiError(''); setGenerarFoma(true); setGenerarCadena(true); }}
                            disabled={realizadoLoading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="primary"
                            style={{ backgroundColor: '#0c8599' }}
                            loading={realizadoLoading}
                            icon={<IconCheck size={16} />}
                            onClick={handleConfirmRealizado}
                            disabled={!oiNumero.trim()}
                        >
                            Confirmar y Guardar
                        </Button>
                    </div>
                </div>
            </Modal>

            <Tabs
                defaultActiveKey="datos_ingresados"
                style={{ width: '100%' }}
                items={[
                    {
                        key: 'datos_ingresados',
                        label: <span><IconDatabase size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Datos ingresados</span>,
                        children: (
                            <Card style={{ width: '100%', overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
                                <Tabs
                                    defaultActiveKey="equipos"
                                    style={{ width: '100%', padding: '0 16px' }}
                                    items={[
                                        {
                                            key: 'equipos',
                                            label: <span><IconTool size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Equipos</span>,
                                            children: (
                                                <div style={{ padding: 16 }}>
                                                    {isPuntual ? (
                                                        <div>
                                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                                                                <IconTool color="orange" size={20} />
                                                                <Title level={5} style={{ margin: 0 }}>Equipos Utilizados</Title>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                                {equipos?.filter((e: any) => e.usado_instalacion === 'S' || e.usado_retiro === 'S').length > 0 ? (
                                                                    equipos
                                                                        .filter((e: any) => e.usado_instalacion === 'S' || e.usado_retiro === 'S')
                                                                        .filter((e: any, idx: number, arr: any[]) => arr.findIndex((o: any) => o.codigo === e.codigo) === idx)
                                                                        .map((eq: any, i: number) => (
                                                                            <div key={i} style={{ border: '1px solid var(--app-border)', borderRadius: 6, padding: 8 }}>
                                                                                <Text strong style={{ fontSize: 13, display: 'block' }}>{eq.nombre}</Text>
                                                                                <Text type="secondary" style={{ fontSize: 12 }}>Código: {eq.codigo}</Text>
                                                                            </div>
                                                                        ))
                                                                ) : <Text type="secondary" italic style={{ fontSize: 13 }}>No hay equipos registrados.</Text>}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
                                                            <div>
                                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                                                                    <IconTool color="orange" size={20} />
                                                                    <Title level={5} style={{ margin: 0 }}>Equipos Instalación</Title>
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                                    {equipos?.filter((e: any) => e.usado_instalacion === 'S').length > 0 ? (
                                                                        equipos.filter((e: any) => e.usado_instalacion === 'S').map((eq: any, i: number) => (
                                                                            <div key={i} style={{ border: '1px solid var(--app-border)', borderRadius: 6, padding: 8 }}>
                                                                                <Text strong style={{ fontSize: 13, display: 'block' }}>{eq.nombre}</Text>
                                                                                <Text type="secondary" style={{ fontSize: 12 }}>Código: {eq.codigo}</Text>
                                                                            </div>
                                                                        ))
                                                                    ) : <Text type="secondary" italic style={{ fontSize: 13 }}>No hay equipos registrados.</Text>}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                                                                    <IconTool color="#1c7ed6" size={20} />
                                                                    <Title level={5} style={{ margin: 0 }}>Equipos Retiro</Title>
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                                    {equipos?.filter((e: any) => e.usado_retiro === 'S').length > 0 ? (
                                                                        equipos.filter((e: any) => e.usado_retiro === 'S').map((eq: any, i: number) => (
                                                                            <div key={i} style={{ border: '1px solid var(--app-border)', borderRadius: 6, padding: 8 }}>
                                                                                <Text strong style={{ fontSize: 13, display: 'block' }}>{eq.nombre}</Text>
                                                                                <Text type="secondary" style={{ fontSize: 12 }}>Código: {eq.codigo}</Text>
                                                                            </div>
                                                                        ))
                                                                    ) : <Text type="secondary" italic style={{ fontSize: 13 }}>No hay equipos registrados.</Text>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
                                                        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--app-border)' }} />
                                                        <Text type="secondary" style={{ fontSize: 12 }}>Condiciones de Medición</Text>
                                                        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--app-border)' }} />
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
                                                        <div>
                                                            <Text strong type="secondary" style={{ fontSize: 11, display: 'block' }}>FLUJO LAMINAR</Text>
                                                            <Tag color={procesos?.instalacion?.condiciones?.flujoLaminar === 'S' ? 'green' : 'default'}>
                                                                {procesos?.instalacion?.condiciones?.flujoLaminar === 'S' ? 'SÍ' : 'NO'}
                                                            </Tag>
                                                        </div>
                                                        <div>
                                                            <Text strong type="secondary" style={{ fontSize: 11, display: 'block' }}>VELOCIDAD UNIFORME</Text>
                                                            <Tag color={procesos?.instalacion?.condiciones?.velUniforme === 'S' ? 'green' : 'default'}>
                                                                {procesos?.instalacion?.condiciones?.velUniforme === 'S' ? 'SÍ' : 'NO'}
                                                            </Tag>
                                                        </div>
                                                    </div>
                                                    <Text strong type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 16 }}>OBSERVACIONES TÉCNICAS</Text>
                                                    <Text type="secondary" italic style={{ fontSize: 13 }}>{procesos?.instalacion?.condiciones?.observaciones || 'Sin observaciones.'}</Text>
                                                </div>
                                            ),
                                        },
                                        {
                                            key: 'datos',
                                            label: <span><IconCalendarTime size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Datos</span>,
                                            children: (
                                                <div style={{ padding: 16 }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(260px, 1fr))`, gap: 20 }}>
                                                        {isPuntual ? (
                                                            <div style={{ maxWidth: 360 }}>
                                                                <Title level={5} style={{ marginBottom: 8, color: '#e8590c' }}>Muestreo</Title>
                                                                <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 16 }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                                                                    <Title level={5} style={{ marginBottom: 8, color: '#e8590c' }}>Instalación</Title>
                                                                    <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 16 }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                                                                    <Title level={5} style={{ marginBottom: 8, color: '#1864ab' }}>Retiro</Title>
                                                                    <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 16 }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                                                                <Title level={5} style={{ marginBottom: 8, color: '#0c8599' }}>Datos Compuestos / VDD</Title>
                                                                <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 16 }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                                        <KV label="Fecha Compuesta" value={parseFechaStr(ficha?.ma_fecha_compuesta)} />
                                                                        <KV label="Hora Compuesta" value={fmt(ficha?.ma_hora_compuesta)} />
                                                                        <KV label="Temp. Compuesta" value={`${fmt(ficha?.ma_temperatura_compuesta)} °C`} color="#0c8599" />
                                                                        <KV label="Temp. Compuesta corregida" value={`${fmt(ficha?.temperatura_corregidacompuesta)} °C`} color="#0c8599" />
                                                                        <KV label="pH Compuesto" value={fmt(ficha?.ma_ph_compuesta)} color="#0c8599" />
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                            <Text type="secondary" strong style={{ fontSize: 13 }}>VDD</Text>
                                                                            <Text strong style={{ fontSize: 15, color: '#1864ab' }}>{fmt(ficha?.vdd)} m³/h</Text>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ),
                                        },
                                        {
                                            key: 'analisis',
                                            label: <span><IconFlask size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Análisis</span>,
                                            children: (
                                                <div style={{ padding: 16 }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                                        {/* Análisis de Terreno */}
                                                        <div>
                                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                                                                <IconTool color="#0c8599" size={20} />
                                                                <Title level={5} style={{ margin: 0 }}>Análisis de Terreno</Title>
                                                            </div>
                                                            <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, overflow: 'auto' }}>
                                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                                    <thead style={{ backgroundColor: 'rgba(12,133,153,0.06)' }}>
                                                                        <tr>
                                                                            <Th>Parámetro</Th>
                                                                            <Th center>Valor</Th>
                                                                            {hasPermission('FI_EXP_VER_UF') && <Th center>UF</Th>}
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {analisis?.filter((item: any) => item.tipo_analisis !== 'Laboratorio' && item.tipo_analisis !== 'CostoOperativo').map((item: any, i: number) => (
                                                                            <tr key={i}>
                                                                                <Td bold>{item.parametro}</Td>
                                                                                <Td center><Tag color="cyan">{item.valor}</Tag></Td>
                                                                                {hasPermission('FI_EXP_VER_UF') && (
                                                                                    <Td center bold>{item.uf_individual > 0 ? Number(item.uf_individual).toFixed(2) : '—'}</Td>
                                                                                )}
                                                                            </tr>
                                                                        ))}
                                                                        {analisis?.filter((item: any) => item.tipo_analisis !== 'Laboratorio' && item.tipo_analisis !== 'CostoOperativo').length === 0 && (
                                                                            <tr>
                                                                                <Td colSpan={3} center>
                                                                                    <Text type="secondary" italic style={{ fontSize: 13 }}>No hay parámetros de terreno registrados.</Text>
                                                                                </Td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>

                                                        {/* Análisis de Laboratorio */}
                                                        <div>
                                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                                                                <IconFlask color="#1c7ed6" size={20} />
                                                                <Title level={5} style={{ margin: 0 }}>Análisis de Laboratorio</Title>
                                                            </div>
                                                            <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, overflow: 'auto' }}>
                                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                                    <thead style={{ backgroundColor: 'var(--app-accent-bg)' }}>
                                                                        <tr>
                                                                            <Th>Parámetro</Th>
                                                                            <Th>Laboratorio Asignado</Th>
                                                                            {hasPermission('FI_EXP_VER_UF') && <Th center>UF</Th>}
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {analisis?.filter((item: any) => item.tipo_analisis === 'Laboratorio').map((item: any, i: number) => (
                                                                            <tr key={i}>
                                                                                <Td bold>{item.parametro}</Td>
                                                                                <Td>
                                                                                    <Text style={{ fontSize: 12, color: item.id_laboratorioensayo_2 > 0 ? '#d9480f' : '#1864ab' }}>
                                                                                        {item.nombre_laboratorioensayo || '—'}
                                                                                    </Text>
                                                                                </Td>
                                                                                {hasPermission('FI_EXP_VER_UF') && (
                                                                                    <Td center bold>{item.uf_individual > 0 ? Number(item.uf_individual).toFixed(2) : '—'}</Td>
                                                                                )}
                                                                            </tr>
                                                                        ))}
                                                                        {analisis?.filter((item: any) => item.tipo_analisis === 'Laboratorio').length === 0 && (
                                                                            <tr>
                                                                                <Td colSpan={3} center>
                                                                                    <Text type="secondary" italic style={{ fontSize: 13 }}>No hay parámetros de laboratorio registrados.</Text>
                                                                                </Td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ),
                                        },
                                        {
                                            key: 'fotos',
                                            label: <span><IconPhoto size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Fotos</span>,
                                            children: (
                                                <div style={{ padding: 16 }}>
                                                    {isPuntual ? (
                                                        <div>
                                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                                                                <IconPhoto color="orange" size={20} />
                                                                <Title level={5} style={{ margin: 0 }}>Fotos Muestreo</Title>
                                                            </div>
                                                            <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 16 }}>
                                                                <PhotoGrid
                                                                    photos={media?.ma_fotografia?.split(';').filter((p: string) => p.toLowerCase().includes('instalacion') || p.toLowerCase().includes('retiro'))
                                                                        .filter((p: string, idx: number, arr: string[]) => arr.indexOf(p) === idx)}
                                                                    emptyText="No hay fotos de muestreo."
                                                                    onOpen={setOpenedImage}
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                                            <div>
                                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                                                                    <IconPhoto color="orange" size={20} />
                                                                    <Title level={5} style={{ margin: 0 }}>Fotos Instalación</Title>
                                                                </div>
                                                                <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 16 }}>
                                                                    <PhotoGrid
                                                                        photos={media?.ma_fotografia?.split(';').filter((p: string) => p.toLowerCase().includes('instalacion'))}
                                                                        emptyText="No hay fotos de instalación."
                                                                        onOpen={setOpenedImage}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <hr style={{ border: 'none', borderTop: '1px solid var(--app-border)' }} />
                                                            <div>
                                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                                                                    <IconPhoto color="#1c7ed6" size={20} />
                                                                    <Title level={5} style={{ margin: 0 }}>Fotos Retiro</Title>
                                                                </div>
                                                                <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 16 }}>
                                                                    <PhotoGrid
                                                                        photos={media?.ma_fotografia?.split(';').filter((p: string) => p.toLowerCase().includes('retiro'))}
                                                                        emptyText="No hay fotos de retiro."
                                                                        onOpen={setOpenedImage}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ),
                                        },
                                        {
                                            key: 'firmas',
                                            label: <span><IconSignature size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Firmas</span>,
                                            children: (
                                                <div style={{ padding: 16 }}>
                                                    {isPuntual ? (
                                                        <FirmasBloque proceso={procesos?.instalacion} nombreOrigen="instalacion" />
                                                    ) : (
                                                        <Tabs
                                                            defaultActiveKey="instalacion_f"
                                                            centered
                                                            items={[
                                                                { key: 'instalacion_f', label: 'Instalación', children: <FirmasBloque proceso={procesos?.instalacion} nombreOrigen="instalacion" /> },
                                                                { key: 'retiro_f', label: 'Retiro', children: <FirmasBloque proceso={procesos?.retiro} nombreOrigen="retiro" /> },
                                                            ]}
                                                        />
                                                    )}
                                                </div>
                                            ),
                                        },
                                    ]}
                                />
                            </Card>
                        ),
                    },
                    {
                        key: 'documentos',
                        label: <span><IconFileText size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Documentos</span>,
                        children: (
                            <Card style={{ width: '100%' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                    <div>
                                        <Title level={4} style={{ margin: 0, color: '#1864ab' }}>Documentos de Respaldo</Title>
                                        <Text type="secondary" style={{ fontSize: 12 }}>Archivos PDF generados para el cliente y laboratorios</Text>
                                    </div>

                                    {media?.documentos && media.documentos.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                            {/* FoMa Group */}
                                            {media.documentos.filter((d: any) => d.tipo === 'FoMa').length > 0 && (
                                                <div>
                                                    <SectionDivider label="FOMA" />
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        {media.documentos.filter((d: any) => d.tipo === 'FoMa').map((doc: any, index: number) => (
                                                            <Card key={`foma-${index}`} size="small">
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                                                                        <IconWrap color="#e03131" bg="rgba(224,49,49,0.1)"><IconFileText size={18} /></IconWrap>
                                                                        <div>
                                                                            <Text strong style={{ fontSize: 13, display: 'block' }}>{doc.label}</Text>
                                                                            <Text type="secondary" style={{ fontSize: 12 }}>{doc.nombre}</Text>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                                        <Button size="small" icon={<IconExternalLink size={12} />} onClick={() => window.open(`${apiClient.defaults.baseURL}${doc.ruta}`, '_blank')}>
                                                                            Abrir
                                                                        </Button>
                                                                        <Button
                                                                            size="small"
                                                                            style={{ color: '#2f9e44' }}
                                                                            icon={<IconSend size={12} />}
                                                                            onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc); setResendSuccess(false); setResendTo(user?.email || ''); setResendCc(''); setResendModalOpen(true); }}
                                                                        >
                                                                            Reenviar
                                                                        </Button>
                                                                        <Button
                                                                            type="text"
                                                                            size="small"
                                                                            icon={<IconDownload size={12} />}
                                                                            onClick={() => handleDownload(`${apiClient.defaults.baseURL}${doc.ruta}`, doc.nombre)}
                                                                        >
                                                                            Descargar
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
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        {media.documentos.filter((d: any) => d.tipo === 'Cadena de Custodia').map((doc: any, index: number) => {
                                                            const isExpanded = expandedDocs.includes(doc.nombre);
                                                            const labTests = analisis?.filter((a: any) =>
                                                                a.tipo_analisis === 'Laboratorio' &&
                                                                doc.label && a.nombre_laboratorioensayo &&
                                                                (a.nombre_laboratorioensayo.toLowerCase().includes(doc.label.toLowerCase()) ||
                                                                    doc.label.toLowerCase().includes(a.nombre_laboratorioensayo.toLowerCase()))
                                                            ) || [];

                                                            return (
                                                                <Card key={`cadena-${index}`} size="small" styles={{ body: { padding: 0 } }}>
                                                                    <div style={{ padding: 8, cursor: 'pointer' }} onClick={() => toggleDoc(doc.nombre)}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                                                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                                                                                <IconWrap color="#1864ab" bg="var(--app-accent-bg)"><IconFileText size={18} /></IconWrap>
                                                                                <div>
                                                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                                                        <Text strong style={{ fontSize: 13 }}>{doc.label}</Text>
                                                                                        {isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                                                                                    </div>
                                                                                    <Text type="secondary" style={{ fontSize: 12 }}>{doc.nombre}</Text>
                                                                                </div>
                                                                            </div>
                                                                            <div style={{ display: 'flex', gap: 8 }}>
                                                                                <Button size="small" icon={<IconExternalLink size={12} />} onClick={(e) => { e.stopPropagation(); window.open(`${apiClient.defaults.baseURL}${doc.ruta}`, '_blank'); }}>
                                                                                    Abrir
                                                                                </Button>
                                                                                <Button
                                                                                    size="small"
                                                                                    style={{ color: '#2f9e44' }}
                                                                                    icon={<IconSend size={12} />}
                                                                                    onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc); setResendSuccess(false); setResendTo(user?.email || ''); setResendCc(''); setResendModalOpen(true); }}
                                                                                >
                                                                                    Reenviar
                                                                                </Button>
                                                                                <Button
                                                                                    type="text"
                                                                                    size="small"
                                                                                    icon={<IconDownload size={12} />}
                                                                                    onClick={(e) => { e.stopPropagation(); handleDownload(`${apiClient.defaults.baseURL}${doc.ruta}`, doc.nombre); }}
                                                                                >
                                                                                    Descargar
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {isExpanded && (
                                                                        <div style={{ padding: 16, backgroundColor: 'var(--app-hover-bg)', borderTop: '1px solid var(--app-border)' }}>
                                                                            <Text type="secondary" strong style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>ANÁLISIS ASOCIADOS A ESTA CADENA:</Text>
                                                                            {labTests.length > 0 ? (
                                                                                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--app-bg-elevated)' }}>
                                                                                    <thead>
                                                                                        <tr><Th>Parámetro</Th></tr>
                                                                                    </thead>
                                                                                    <tbody>
                                                                                        {labTests.map((t: any, idx: number) => (
                                                                                            <tr key={idx}><Td>{t.parametro}</Td></tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            ) : (
                                                                                <Text type="secondary" italic style={{ fontSize: 12 }}>No se pudieron vincular análisis automáticamente por nombre.</Text>
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
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '32px 0' }}>
                                            <IconFileText size={40} color="gray" />
                                            <Text type="secondary">No se encontraron documentos (FoMa/Cadenas) en la carpeta del correlativo.</Text>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        ),
                    },
                ]}
            />

            <Modal open={!!openedImage} onCancel={() => setOpenedImage(null)} footer={null} width="80%" centered styles={{ body: { padding: 0 } }}>
                {openedImage && (
                    <img
                        src={openedImage}
                        style={{ maxHeight: '90vh', width: '100%', objectFit: 'contain' }}
                        alt=""
                    />
                )}
            </Modal>

            <Modal
                open={resendModalOpen}
                onCancel={() => setResendModalOpen(false)}
                footer={null}
                width={520}
                centered
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconWrap color="#1864ab" bg="var(--app-accent-bg)" size={28}><IconSend size={16} /></IconWrap>
                        <Text strong style={{ color: '#1864ab' }}>Gestión de Reenvío de Documentos</Text>
                    </div>
                }
            >
                {selectedDocument && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                        {resendSuccess ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 0' }}>
                                <IconWrap color="#2f9e44" bg="rgba(47,158,68,0.15)" size={80}><IconCheck size={40} /></IconWrap>
                                <Title level={3} style={{ margin: 0, textAlign: 'center' }}>¡Documento Enviado!</Title>
                                <Text type="secondary" style={{ textAlign: 'center' }}>El documento ha sido despachado exitosamente.</Text>
                                <Button onClick={() => setResendModalOpen(false)} style={{ marginTop: 16 }}>
                                    Cerrar y volver a la ficha
                                </Button>
                            </div>
                        ) : (
                            <>
                                <Alert type="info" showIcon icon={<IconMailForward size={16} />} message={<>Está preparando el envío de: <b>{selectedDocument.label}</b> ({selectedDocument.tipo || 'Documento'})</>} />

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                                    <div>
                                        <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Para (To)</Text>
                                        <Input
                                            placeholder="correo@ejemplo.com"
                                            value={resendTo}
                                            onChange={(e) => setResendTo(e.target.value)}
                                            disabled // Temporary for testing phase
                                        />
                                        <Text type="secondary" style={{ fontSize: 11 }}>Destinatario bloqueado en fase de pruebas.</Text>
                                    </div>
                                    <div>
                                        <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Copia (CC)</Text>
                                        <Input
                                            placeholder="copia@ejemplo.com"
                                            value={resendCc}
                                            onChange={(e) => setResendCc(e.target.value)}
                                        />
                                        <Text type="secondary" style={{ fontSize: 11 }}>Separar multiplicidad con comas.</Text>
                                    </div>

                                    <Card size="small" style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                                            <IconWrap color="#e03131" bg="rgba(224,49,49,0.1)" size={36}><IconFileText size={20} /></IconWrap>
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <Text style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>Archivo Adjunto</Text>
                                                <Text type="secondary" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                                                    {selectedDocument.nombre || 'Documento.pdf'}
                                                </Text>
                                            </div>
                                        </div>
                                    </Card>

                                    {resendError && <Alert type="error" message="Error de envío" description={resendError} />}

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                        <Button onClick={() => setResendModalOpen(false)} disabled={resendLoading}>Cancelar</Button>
                                        <Button
                                            type="primary"
                                            style={{ backgroundColor: '#2f9e44' }}
                                            onClick={handleResend}
                                            loading={resendLoading}
                                            icon={<IconSend size={16} />}
                                        >
                                            Enviar Correo
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

function IconWrap({ children, color, bg, size = 24 }: { children: React.ReactNode; color: string; bg: string; size?: number }) {
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', backgroundColor: bg, color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
            {children}
        </div>
    );
}

function SectionDivider({ label }: { label: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Text type="secondary" strong style={{ fontSize: 11 }}>{label}</Text>
            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--app-border)' }} />
        </div>
    );
}

function PhotoGrid({ photos, emptyText, onOpen }: { photos?: string[]; emptyText: string; onOpen: (url: string) => void }) {
    if (!photos || photos.length === 0) {
        return <Text type="secondary" italic style={{ fontSize: 13 }}>{emptyText}</Text>;
    }
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {photos.map((photo, idx) => {
                const url = `${apiClient.defaults.baseURL}${photo}`;
                return (
                    <Card key={idx} size="small" hoverable style={{ cursor: 'pointer' }} styles={{ body: { padding: 4 } }} onClick={() => onOpen(url)}>
                        <img
                            src={url}
                            style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 4 }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Card>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
                    <div>
                        <Text type="secondary" strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>MUESTREADOR</Text>
                        <Text strong style={{ fontSize: 16 }}>{proceso?.nombreMuestreador || '—'}</Text>
                        <div style={{ marginTop: 16, padding: 8, backgroundColor: 'var(--app-hover-bg)', borderRadius: 8, border: '1px dashed var(--app-border)', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {firmaMuestreador ? (
                                <img src={`${apiClient.defaults.baseURL}${firmaMuestreador.ruta}`} style={{ height: 100, objectFit: 'contain' }} alt={`Firma muestreador ${nombreOrigen}`} />
                            ) : <Text type="secondary" italic style={{ fontSize: 12 }}>Sin firma registrada.</Text>}
                        </div>
                    </div>
                    <div>
                        <Text type="secondary" strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>OBSERVACIONES MUESTREADOR</Text>
                        <div style={{ padding: 16, backgroundColor: 'var(--app-hover-bg)', borderRadius: 8, height: 160, overflowY: 'auto' }}>
                            <Text italic style={{ fontSize: 13 }}>
                                {proceso?.observaciones || 'Sin observaciones.'}
                            </Text>
                        </div>
                    </div>
                </div>
            </Card>

            <SectionDivider label="Observador de terreno" />

            {tieneObservador ? (
                <Card>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
                        <div>
                            <Text type="secondary" strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>NOMBRE OBSERVADOR</Text>
                            <Text strong style={{ fontSize: 14 }}>{proceso.nombreObservador}</Text>
                            <Text type="secondary" strong style={{ fontSize: 12, display: 'block', marginTop: 16, marginBottom: 4 }}>CARGO</Text>
                            <Text style={{ fontSize: 13 }}>{proceso.cargoObservador || '—'}</Text>
                        </div>
                        <div>
                            <Text type="secondary" strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>FIRMA OBSERVADOR</Text>
                            <div style={{ padding: 8, backgroundColor: 'var(--app-hover-bg)', borderRadius: 8, border: '1px dashed var(--app-border)', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {firmaObservador ? (
                                    <img src={`${apiClient.defaults.baseURL}${firmaObservador.ruta}`} style={{ height: 100, objectFit: 'contain' }} alt={`Firma observador ${nombreOrigen}`} />
                                ) : <Text type="secondary" italic style={{ fontSize: 12 }}>Sin firma registrada.</Text>}
                            </div>
                        </div>
                    </div>
                </Card>
            ) : (
                <Alert type="info" showIcon icon={<IconAlertCircle size={16} />} message="Observador de terreno no registrado en el proceso" />
            )}
        </div>
    );
}
