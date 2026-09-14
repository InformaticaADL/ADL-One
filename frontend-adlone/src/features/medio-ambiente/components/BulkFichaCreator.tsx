import React, { useState, useRef } from 'react';
import { Typography, Button, Progress, Alert, Card } from 'antd';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconUpload,
    IconCheck,
    IconAlertCircle,
    IconDatabaseExport,
    IconPdf,
    IconFileSpreadsheet,
    IconDownload
} from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { fichaService } from '../services/ficha.service';
import { useAuth } from '../../../contexts/AuthContext';
import { BulkReviewGrid } from './BulkReviewGrid';

const { Title, Text } = Typography;

interface Props {
    onBack: () => void;
    onSuccess: () => void;
}

export const BulkFichaCreator: React.FC<Props> = ({ onBack, onSuccess }) => {
    const { user } = useAuth();
    const isMobile = useMediaQuery('(max-width: 768px)');

    // State
    const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Upload, 2: Parsing/Review, 3: Committing
    const [isParsing, setIsParsing] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Data
    const [files, setFiles] = useState<File[]>([]);
    const [parsedItems, setParsedItems] = useState<any[]>([]);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
    const [commitResults, setCommitResults] = useState<any>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [parseMeta, setParseMeta] = useState<{ truncated?: boolean; maxFichas?: number; total?: number } | null>(null);
    const [hovering, setHovering] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files).filter(f =>
                f.type === 'application/pdf' ||
                f.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                f.name.endsWith('.xlsx')
            );
            if (selectedFiles.length === 0) {
                setError('Por favor, seleccione archivos válidos (PDF o Excel .xlsx).');
                return;
            }
            if (selectedFiles.length > 1000) {
                setError('El límite máximo es de 1000 archivos por lote.');
                return;
            }
            setError(null);
            setFiles(selectedFiles);
        }
    };

    const handleUploadAndParse = async () => {
        if (files.length === 0) return;

        setIsParsing(true);
        setError(null);
        setStep(2);
        setProgress(10); // Fake progress to show activity

        try {
            const formData = new FormData();
            files.forEach(f => formData.append('files', f));

            // Progress is mostly a placeholder since the upload/parse is a single request,
            // but we could set up Axios upload progress if needed.
            setProgress(30);

            const result = await fichaService.bulkParse(formData);

            if (result.success && result.data?.items) {
                const data = result.data;
                setParsedItems(data.items);
                setParseMeta({ truncated: data.truncated, maxFichas: data.maxFichas, total: data.total });

                // Auto-select all READY items
                setSelectedIndices(data.items.map((it: any, i: number) => (it.status === 'READY' || it.status === 'WARNING' ? i : -1)).filter((i: number) => i !== -1));
                setProgress(100);
            } else {
                throw new Error(result.message || 'Error al procesar los archivos');
            }
        } catch (err: any) {
            console.error('Parse error:', err);
            setError(err.message || 'Error de conexión al procesar los archivos');
            setStep(1); // Go back on error
        } finally {
            setIsParsing(false);
        }
    };

    const handleCommit = async () => {
        if (selectedIndices.length === 0) return;

        setIsCommitting(true);
        setError(null);
        setStep(3);

        try {
            const itemsToCommit = selectedIndices.map(idx => ({ ...parsedItems[idx] }));

            const result = await fichaService.bulkCommit({
                items: itemsToCommit,
                userId: user?.id || (user as any)?.id_usuario
            });

            if (result.success) {
                setCommitResults(result.data);
            } else {
                throw new Error(result.message || 'Error al guardar las fichas');
            }
        } catch (err: any) {
            console.error('Commit error:', err);
            setError(err.message || 'Error de conexión al guardar las fichas');
            setStep(2); // Go back on error
        } finally {
            setIsCommitting(false);
        }
    };

    // --- RENDER HELPERS ---

    const renderStep1Upload = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', marginTop: 24 }}>
            <input
                type="file"
                multiple
                accept="application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
            />

            <div
                style={{
                    padding: 40,
                    border: `2px dashed ${hovering ? '#4dabf7' : 'var(--app-border)'}`,
                    borderRadius: 16,
                    width: '100%',
                    maxWidth: 600,
                    cursor: 'pointer',
                    textAlign: 'center',
                    backgroundColor: hovering ? 'var(--app-accent-bg)' : 'var(--app-hover-bg)',
                    transition: 'all 0.2s ease'
                }}
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
            >
                <div style={{
                    width: 60, height: 60, borderRadius: '50%', backgroundColor: 'var(--app-accent-bg)', color: '#1677ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                }}>
                    <IconUpload size={30} />
                </div>
                <Text strong style={{ fontSize: 16, display: 'block' }}>Haga clic o arrastre archivos aquí</Text>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 8 }}>
                    Soporta archivos PDF y Planillas Excel (.xlsx).
                </Text>

                {files.length > 0 && (
                    <Alert
                        type="info"
                        showIcon
                        icon={files[0].name.endsWith('.xlsx') ? <IconFileSpreadsheet size={16} /> : <IconPdf size={16} />}
                        message={`${files.length} ${files.length === 1 ? 'archivo seleccionado' : 'archivos seleccionados'}`}
                        style={{ marginTop: 20, textAlign: 'left' }}
                    />
                )}
            </div>

            <Button
                size="large"
                disabled={files.length === 0}
                onClick={handleUploadAndParse}
                type="primary"
                style={{ backgroundColor: '#9c36b5' }}
                icon={<IconDatabaseExport size={20} />}
            >
                Procesar Archivos ({files.length})
            </Button>

            <Button
                type="text"
                loading={isDownloading}
                icon={<IconDownload size={16} />}
                onClick={async () => {
                    setIsDownloading(true);
                    try { await fichaService.downloadBulkTemplate(); }
                    catch { /* handled by service */ }
                    finally { setIsDownloading(false); }
                }}
            >
                Descargar plantilla Excel (con maestros actualizados)
            </Button>
        </div>
    );

    const renderStep2Review = () => {
        if (isParsing) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', marginTop: 24, padding: '24px 0' }}>
                    <Text strong style={{ fontSize: 16 }}>Extrayendo y mapeando datos...</Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>Esto puede tomar unos minutos dependiendo de la cantidad de archivos.</Text>
                    <Progress percent={progress} status="active" strokeColor="#9c36b5" style={{ width: '100%' }} />
                </div>
            );
        }

        const readyCount = parsedItems.filter(i => i.status === 'READY').length;
        const warningCount = parsedItems.filter(i => i.status === 'WARNING').length;
        const errorCount = parsedItems.filter(i => i.status === 'ERROR').length;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <Title level={3} style={{ margin: 0, color: '#1864ab' }}>Revisión de Datos</Title>
                        <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                            Verifique que el sistema haya mapeado correctamente los catálogos antes de crear las fichas.
                        </Text>
                        <Text strong style={{ fontSize: 13, color: '#1864ab', display: 'block', marginTop: 4 }}>
                            {parsedItems.length} fichas detectadas en el Excel.
                        </Text>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button onClick={() => { setStep(1); setFiles([]); setParsedItems([]); }}>
                            Cancelar
                        </Button>
                        <Button
                            type="primary"
                            style={{ backgroundColor: '#2f9e44' }}
                            onClick={handleCommit}
                            disabled={selectedIndices.length === 0}
                            loading={isCommitting}
                            icon={<IconCheck size={18} />}
                        >
                            Crear Fichas ({selectedIndices.length})
                        </Button>
                    </div>
                </div>

                {parseMeta?.truncated && (
                    <Alert
                        type="warning"
                        showIcon
                        icon={<IconAlertCircle size={16} />}
                        message="Lote truncado"
                        description={
                            <Text style={{ fontSize: 13 }}>
                                El Excel contiene más de {parseMeta.maxFichas} fichas. Solo se procesaron las primeras {parseMeta.maxFichas}.
                                Divida el archivo en lotes más pequeños para cargar el resto.
                            </Text>
                        }
                    />
                )}

                <div style={{ display: 'flex', gap: 12 }}>
                    <Alert type="success" style={{ flex: 1, textAlign: 'center' }} message={<Text strong style={{ fontSize: 13 }}>{readyCount} Listas</Text>} />
                    <Alert type="warning" style={{ flex: 1, textAlign: 'center' }} message={<Text strong style={{ fontSize: 13 }}>{warningCount} Advertencias</Text>} />
                    <Alert type="error" style={{ flex: 1, textAlign: 'center' }} message={<Text strong style={{ fontSize: 13 }}>{errorCount} Errores</Text>} />
                </div>

                <Card size="small">
                    <BulkReviewGrid
                        items={parsedItems}
                        selectedIndices={selectedIndices}
                        onSelectChange={setSelectedIndices}
                    />
                </Card>
            </div>
        );
    };

    const renderStep3Result = () => {
        if (isCommitting) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', marginTop: 24, padding: '24px 0' }}>
                    <Text strong style={{ fontSize: 16 }}>Guardando fichas en la base de datos...</Text>
                    <Progress percent={100} status="active" strokeColor="#2f9e44" style={{ width: '100%' }} />
                </div>
            );
        }

        if (!commitResults) return null;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', marginTop: 24, padding: '24px 0' }}>
                <div style={{
                    width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(47,158,68,0.15)', color: '#2f9e44',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <IconCheck size={40} />
                </div>
                <Title level={2} style={{ margin: 0 }}>¡Proceso Completado!</Title>
                <Text style={{ fontSize: 16 }}>
                    Se han creado exitosamente <b>{commitResults.created}</b> de {commitResults.total} fichas solicitadas.
                </Text>

                {commitResults.failed > 0 && (
                    <Alert
                        type="warning"
                        showIcon
                        message="Algunas fichas fallaron"
                        description={<Text style={{ fontSize: 13 }}>{commitResults.failed} fichas no pudieron ser creadas por errores en base de datos.</Text>}
                    />
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                    <Button onClick={onBack}>
                        Volver al inicio
                    </Button>
                    <Button type="primary" onClick={onSuccess}>
                        Ver en Explorador
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
            {step === 1 && (
                <PageHeader
                    title="Carga Masiva de Fichas (PDF / Excel)"
                    onBack={onBack}
                    breadcrumbItems={[{ label: 'Fichas de Ingreso', onClick: onBack }, { label: 'Carga masiva' }]}
                />
            )}

            <Card style={{ borderRadius: 16 }} styles={{ body: { padding: isMobile ? 16 : 32 } }}>
                {error && (
                    <Alert
                        type="error"
                        showIcon
                        icon={<IconAlertCircle size={16} />}
                        message="Error"
                        description={error}
                        style={{ marginBottom: 24 }}
                    />
                )}

                {step === 1 && renderStep1Upload()}
                {step === 2 && renderStep2Review()}
                {step === 3 && renderStep3Result()}
            </Card>
        </div>
    );
};
