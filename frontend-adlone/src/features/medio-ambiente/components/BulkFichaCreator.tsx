import React, { useState, useRef } from 'react';
import {
    Stack,
    Paper,
    Title,
    Text,
    Button,
    Group,
    Box,
    Progress,
    Alert,
    ThemeIcon
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
    IconUpload,
    IconCheck,
    IconAlertCircle,
    IconDatabaseExport,
    IconPdf
} from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { fichaService } from '../services/ficha.service';
import { useAuth } from '../../../contexts/AuthContext';
import { BulkReviewGrid } from './BulkReviewGrid';

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
    const [ufTotals, setUfTotals] = useState<Record<number, number>>({});

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
            if (selectedFiles.length === 0) {
                setError('Por favor, seleccione únicamente archivos PDF.');
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
            files.forEach(f => formData.append('pdfs', f));
            
            // Progress is mostly a placeholder since the upload/parse is a single request, 
            // but we could set up Axios upload progress if needed.
            setProgress(30);

            const result = await fichaService.bulkParse(formData);
            
            if (result.success && result.data?.items) {
                setParsedItems(result.data.items);
                // Auto-select all READY items
                const initialSelection = result.data.items
                    .map((item: any, idx: number) => (item.status === 'READY' || item.status === 'WARNING') ? idx : -1)
                    .filter((idx: number) => idx !== -1);
                
                setSelectedIndices(initialSelection);
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
            // Inject uf_individual into each analysis before commit
            const itemsToCommit = selectedIndices.map(idx => {
                const item = { ...parsedItems[idx] };
                const ufTotal = ufTotals[idx] || 0;
                const matchedCount = (item.analisis || []).filter((a: any) => a._matched).length;
                const ufIndividual = (ufTotal > 0 && matchedCount > 0) ? Math.round((ufTotal / matchedCount) * 100) / 100 : 0;
                
                item.analisis = (item.analisis || []).map((a: any) => ({
                    ...a,
                    uf_individual: a._matched ? ufIndividual : 0
                }));
                return item;
            });
            
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
        <Stack gap="xl" align="center" mt="xl">
            <input 
                type="file" 
                multiple 
                accept="application/pdf" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileSelect}
            />
            
            <Box 
                p={40} 
                style={{ 
                    border: '2px dashed var(--mantine-color-gray-4)', 
                    borderRadius: 16,
                    width: '100%',
                    maxWidth: 600,
                    cursor: 'pointer',
                    textAlign: 'center',
                    backgroundColor: 'var(--mantine-color-gray-0)',
                    transition: 'all 0.2s ease'
                }}
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--mantine-color-blue-5)';
                    e.currentTarget.style.backgroundColor = 'var(--mantine-color-blue-0)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--mantine-color-gray-4)';
                    e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-0)';
                }}
            >
                <ThemeIcon size={60} radius="xl" variant="light" color="blue" mb="md">
                    <IconUpload size={30} />
                </ThemeIcon>
                <Text fw={700} size="lg">Haga clic o arrastre archivos aquí</Text>
                <Text size="sm" c="dimmed" mt="xs">
                    Solo se aceptan archivos PDF. Puede subir hasta 1000 archivos a la vez.
                </Text>
                
                {files.length > 0 && (
                    <Alert color="blue" variant="light" mt="lg" icon={<IconPdf size={16} />}>
                        {files.length} archivos seleccionados
                    </Alert>
                )}
            </Box>

            <Button 
                size="lg" 
                disabled={files.length === 0} 
                onClick={handleUploadAndParse}
                color="grape"
                leftSection={<IconDatabaseExport size={20} />}
            >
                Procesar Archivos ({files.length})
            </Button>
        </Stack>
    );

    const renderStep2Review = () => {
        if (isParsing) {
            return (
                <Stack gap="xl" align="center" mt="xl" py="xl">
                    <Text fw={600} size="lg">Extrayendo y mapeando datos...</Text>
                    <Text size="sm" c="dimmed">Esto puede tomar unos minutos dependiendo de la cantidad de archivos.</Text>
                    <Progress value={progress} w="100%" size="xl" radius="xl" striped animated color="grape" />
                </Stack>
            );
        }

        const readyCount = parsedItems.filter(i => i.status === 'READY').length;
        const warningCount = parsedItems.filter(i => i.status === 'WARNING').length;
        const errorCount = parsedItems.filter(i => i.status === 'ERROR').length;

        return (
            <Stack gap="md">
                <Group justify="space-between" align="flex-end">
                    <Box>
                        <Title order={3} c="blue.8">Revisión de Datos</Title>
                        <Text size="sm" c="dimmed">
                            Verifique que el sistema haya mapeado correctamente los catálogos antes de crear las fichas.
                        </Text>
                    </Box>
                    <Group gap="xs">
                        <Button variant="default" onClick={() => { setStep(1); setFiles([]); setParsedItems([]); }}>
                            Cancelar
                        </Button>
                        <Button 
                            color="green" 
                            onClick={handleCommit}
                            disabled={selectedIndices.length === 0}
                            leftSection={<IconCheck size={18} />}
                        >
                            Crear Fichas ({selectedIndices.length})
                        </Button>
                    </Group>
                </Group>

                <Group gap="md">
                    <Alert variant="light" color="green" p="xs" style={{ flex: 1 }}>
                        <Text fw={600} size="sm" ta="center">{readyCount} Listas</Text>
                    </Alert>
                    <Alert variant="light" color="yellow" p="xs" style={{ flex: 1 }}>
                        <Text fw={600} size="sm" ta="center">{warningCount} Advertencias</Text>
                    </Alert>
                    <Alert variant="light" color="red" p="xs" style={{ flex: 1 }}>
                        <Text fw={600} size="sm" ta="center">{errorCount} Errores</Text>
                    </Alert>
                </Group>

                <Paper withBorder>
                    <BulkReviewGrid 
                        items={parsedItems} 
                        selectedIndices={selectedIndices}
                        onSelectChange={setSelectedIndices}
                        ufTotals={ufTotals}
                        onUfTotalChange={(idx, val) => setUfTotals(prev => ({ ...prev, [idx]: val }))}
                    />
                </Paper>
            </Stack>
        );
    };

    const renderStep3Result = () => {
        if (isCommitting) {
            return (
                <Stack gap="xl" align="center" mt="xl" py="xl">
                    <Text fw={600} size="lg">Guardando fichas en la base de datos...</Text>
                    <Progress value={100} w="100%" size="xl" radius="xl" striped animated color="green" />
                </Stack>
            );
        }

        if (!commitResults) return null;

        return (
            <Stack gap="xl" align="center" mt="xl" py="xl">
                <ThemeIcon size={80} radius="xl" color="green" variant="light">
                    <IconCheck size={40} />
                </ThemeIcon>
                <Title order={2}>¡Proceso Completado!</Title>
                <Text size="lg">
                    Se han creado exitosamente <b>{commitResults.created}</b> de {commitResults.total} fichas solicitadas.
                </Text>
                
                {commitResults.failed > 0 && (
                    <Alert color="orange" title="Algunas fichas fallaron">
                        <Text size="sm">{commitResults.failed} fichas no pudieron ser creadas por errores en base de datos.</Text>
                    </Alert>
                )}

                <Group mt="xl">
                    <Button variant="default" onClick={onBack}>
                        Volver al inicio
                    </Button>
                    <Button color="blue" onClick={onSuccess}>
                        Ver en Explorador
                    </Button>
                </Group>
            </Stack>
        );
    };

    return (
        <Stack gap="lg" style={{ width: '100%' }}>
            {step === 1 && <PageHeader title="Carga Masiva de Fichas (PDF)" onBack={onBack} />}
            
            <Paper withBorder p={isMobile ? 'md' : 'xl'} radius="lg" shadow="sm">
                {error && (
                    <Alert color="red" icon={<IconAlertCircle size={16} />} title="Error" mb="lg">
                        {error}
                    </Alert>
                )}

                {step === 1 && renderStep1Upload()}
                {step === 2 && renderStep2Review()}
                {step === 3 && renderStep3Result()}
            </Paper>
        </Stack>
    );
};
