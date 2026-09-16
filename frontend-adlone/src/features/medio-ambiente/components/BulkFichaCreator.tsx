import React, { useState, useRef } from 'react';
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

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
        <div className="mt-6 flex flex-col items-center gap-6">
            <input
                type="file"
                multiple
                accept="application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
            />

            <div
                className={cn(
                    'w-full max-w-[600px] cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors',
                    hovering ? 'border-[#4dabf7] bg-primary/10' : 'border-border bg-muted/50'
                )}
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
            >
                <div className="mx-auto mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-primary/10 text-primary">
                    <IconUpload size={30} />
                </div>
                <span className="block text-base font-semibold">Haga clic o arrastre archivos aquí</span>
                <span className="mt-2 block text-[13px] text-muted-foreground">
                    Soporta archivos PDF y Planillas Excel (.xlsx).
                </span>

                {files.length > 0 && (
                    <InlineAlert type="info" icon={files[0].name.endsWith('.xlsx') ? <IconFileSpreadsheet size={16} /> : <IconPdf size={16} />} className="mt-5 text-left">
                        {files.length} {files.length === 1 ? 'archivo seleccionado' : 'archivos seleccionados'}
                    </InlineAlert>
                )}
            </div>

            <Button
                size="lg"
                disabled={files.length === 0}
                onClick={handleUploadAndParse}
                className="bg-[#9c36b5] text-white hover:bg-[#9c36b5]/90"
            >
                <IconDatabaseExport size={20} />
                Procesar Archivos ({files.length})
            </Button>

            <Button
                variant="ghost"
                disabled={isDownloading}
                onClick={async () => {
                    setIsDownloading(true);
                    try { await fichaService.downloadBulkTemplate(); }
                    catch { /* handled by service */ }
                    finally { setIsDownloading(false); }
                }}
            >
                {isDownloading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <IconDownload size={16} />}
                Descargar plantilla Excel (con maestros actualizados)
            </Button>
        </div>
    );

    const renderStep2Review = () => {
        if (isParsing) {
            return (
                <div className="mt-6 flex flex-col items-center gap-6 py-6">
                    <span className="text-base font-semibold">Extrayendo y mapeando datos...</span>
                    <span className="text-[13px] text-muted-foreground">Esto puede tomar unos minutos dependiendo de la cantidad de archivos.</span>
                    <ProgressBar percent={progress} colorClassName="bg-[#9c36b5]" />
                </div>
            );
        }

        const readyCount = parsedItems.filter(i => i.status === 'READY').length;
        const warningCount = parsedItems.filter(i => i.status === 'WARNING').length;
        const errorCount = parsedItems.filter(i => i.status === 'ERROR').length;

        return (
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h3 className="m-0 text-xl font-semibold text-[#1864ab]">Revisión de Datos</h3>
                        <span className="block text-[13px] text-muted-foreground">
                            Verifique que el sistema haya mapeado correctamente los catálogos antes de crear las fichas.
                        </span>
                        <span className="mt-1 block text-[13px] font-semibold text-[#1864ab]">
                            {parsedItems.length} fichas detectadas en el Excel.
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => { setStep(1); setFiles([]); setParsedItems([]); }}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-[#2f9e44] text-white hover:bg-[#2f9e44]/90"
                            onClick={handleCommit}
                            disabled={selectedIndices.length === 0 || isCommitting}
                        >
                            {isCommitting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <IconCheck size={18} />}
                            Crear Fichas ({selectedIndices.length})
                        </Button>
                    </div>
                </div>

                {parseMeta?.truncated && (
                    <InlineAlert type="warning" icon={<IconAlertCircle size={16} />} title="Lote truncado">
                        El Excel contiene más de {parseMeta.maxFichas} fichas. Solo se procesaron las primeras {parseMeta.maxFichas}.
                        Divida el archivo en lotes más pequeños para cargar el resto.
                    </InlineAlert>
                )}

                <div className="flex gap-3">
                    <InlineAlert type="success" className="flex-1 justify-center text-center"><strong className="text-[13px]">{readyCount} Listas</strong></InlineAlert>
                    <InlineAlert type="warning" className="flex-1 justify-center text-center"><strong className="text-[13px]">{warningCount} Advertencias</strong></InlineAlert>
                    <InlineAlert type="error" className="flex-1 justify-center text-center"><strong className="text-[13px]">{errorCount} Errores</strong></InlineAlert>
                </div>

                <Card className="p-3">
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
                <div className="mt-6 flex flex-col items-center gap-6 py-6">
                    <span className="text-base font-semibold">Guardando fichas en la base de datos...</span>
                    <ProgressBar percent={100} colorClassName="bg-[#2f9e44]" />
                </div>
            );
        }

        if (!commitResults) return null;

        return (
            <div className="mt-6 flex flex-col items-center gap-6 py-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/15 text-success">
                    <IconCheck size={40} />
                </div>
                <h2 className="m-0 text-2xl font-semibold">¡Proceso Completado!</h2>
                <p className="text-base">
                    Se han creado exitosamente <strong>{commitResults.created}</strong> de {commitResults.total} fichas solicitadas.
                </p>

                {commitResults.failed > 0 && (
                    <InlineAlert type="warning" icon={<IconAlertCircle size={16} />} title="Algunas fichas fallaron">
                        {commitResults.failed} fichas no pudieron ser creadas por errores en base de datos.
                    </InlineAlert>
                )}

                <div className="mt-6 flex gap-3">
                    <Button variant="outline" onClick={onBack}>
                        Volver al inicio
                    </Button>
                    <Button onClick={onSuccess}>
                        Ver en Explorador
                    </Button>
                </div>
            </div>
        );
    };

    return (
        <div className="shadcn-scope flex w-full flex-col gap-6">
            {step === 1 && (
                <PageHeader
                    title="Carga Masiva de Fichas (PDF / Excel)"
                    onBack={onBack}
                    breadcrumbItems={[{ label: 'Fichas de Ingreso', onClick: onBack }, { label: 'Carga masiva' }]}
                />
            )}

            <Card className={cn('rounded-2xl', isMobile ? 'p-4' : 'p-8')}>
                {error && (
                    <InlineAlert type="error" icon={<IconAlertCircle size={16} />} title="Error" className="mb-6">
                        {error}
                    </InlineAlert>
                )}

                {step === 1 && renderStep1Upload()}
                {step === 2 && renderStep2Review()}
                {step === 3 && renderStep3Result()}
            </Card>
        </div>
    );
};

const ALERT_STYLES: Record<string, string> = {
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    error: 'border-destructive/30 bg-destructive/10 text-destructive',
    info: 'border-primary/30 bg-primary/10 text-primary',
};

function InlineAlert({ type, icon, title, children, className }: { type: 'success' | 'warning' | 'error' | 'info'; icon?: React.ReactNode; title?: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('flex items-start gap-2 rounded-lg border px-3 py-2', ALERT_STYLES[type], className)}>
            {icon}
            <div className="flex-1 text-xs">
                {title && <span className="block font-semibold">{title}</span>}
                <span>{children}</span>
            </div>
        </div>
    );
}

function ProgressBar({ percent, colorClassName }: { percent: number; colorClassName: string }) {
    return (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full transition-all', colorClassName)} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
        </div>
    );
}
