import React, { useEffect, useState, useRef } from 'react';
import { useNavStore } from '../../../store/navStore';
import { fichaService } from '../services/ficha.service';
import { AntecedentesForm, type AntecedentesFormHandle } from '../components/AntecedentesForm';
import { AnalysisForm } from '../components/AnalysisForm';
import { ObservacionesForm } from '../components/ObservacionesForm';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import { PageHeader } from '../../../components/layout/PageHeader';
import { mapToAntecedentes } from '../utils/fichaMapping';
import { 
    Stack, 
    Paper, 
    Tabs, 
    LoadingOverlay, 
    Box, 
    Button,
    Group,
    Alert
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { 
    IconClipboardList, 
    IconFlask, 
    IconDeviceFloppy, 
    IconX,
    IconInfoCircle,
    IconFileText,
    IconArrowRight
} from '@tabler/icons-react';

import { CatalogosProvider } from '../context/CatalogosContext';

const RemuestreoPageContent: React.FC = () => {
    const { selectedFichaId, setActiveSubmodule, setFichasMode } = useNavStore();
    const { showToast } = useToast();
    const auth = useAuth();
    const catalogos = useCachedCatalogos();
    const isMobile = useMediaQuery('(max-width: 768px)');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('antecedentes');
    const [originalFicha, setOriginalFicha] = useState<any>(null);
    const [analysisList, setAnalysisList] = useState<any[]>([]);
    const [observaciones, setObservaciones] = useState<string>('');
    
    const antecedentesRef = useRef<AntecedentesFormHandle>(null);
    const mappedInitialDataRef = useRef<any>(null);

    useEffect(() => {
        loadData();
    }, [selectedFichaId]);

    const loadData = async () => {
        if (!selectedFichaId) return;
        setLoading(true);
        try {
            const [response, labsData] = await Promise.all([
                fichaService.getById(selectedFichaId),
                catalogos.getLaboratorios()
            ]);

            if (response && (response.success !== false)) {
                const data = response.data || response;
                setOriginalFicha(data);

                // Map Antecedentes
                mappedInitialDataRef.current = mapToAntecedentes(data, data.agenda);

                // Map Analysis
                const getLabName = (id: any) => {
                    if (!id) return null;
                    const lab = (labsData || []).find((l: any) => l.id_laboratorioensayo === id || l.id_laboratorioensayo === Number(id));
                    return lab ? lab.nombre_laboratorioensayo : null;
                };

                const mappedAnalysis = (data.detalles || []).map((row: any, index: number) => ({
                    ...row,
                    savedId: `remuestreo-${index}-${Date.now()}`,
                    nombre_tecnica: row.nombre_tecnica || row.nombre_determinacion || row.nombre_examen,
                    nombre_laboratorioensayo: getLabName(row.id_laboratorioensayo),
                    nombre_laboratorioensayo_2: getLabName(row.id_laboratorioensayo_2 || row.id_laboratorioensayo2),
                    item: index + 1
                }));
                setAnalysisList(mappedAnalysis);
                setObservaciones('');

            } else {
                showToast({ type: 'error', message: 'No se pudo cargar la ficha original' });
            }
        } catch (error) {
            console.error("Error loading original ficha:", error);
            showToast({ type: 'error', message: 'Error al cargar datos' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateRemuestreo = async () => {
        if (!antecedentesRef.current) return;
        
        const antecedentesData = antecedentesRef.current.getData();
        
        // Basic validation
        if (analysisList.length === 0) {
            showToast({ type: 'warning', message: 'Debe haber al menos un análisis grabado' });
            setActiveTab('analisis');
            return;
        }

        const payload = {
            antecedentes: antecedentesData,
            analisis: analysisList,
            observaciones: observaciones,
            user: auth?.user,
            isRemuestreo: true,
            originalFichaId: selectedFichaId
        };

        try {
            setSaving(true);
            const response = await fichaService.create(payload);
            if (response && (response.success || response.id)) {
                showToast({ type: 'success', message: 'Remuestreo creado exitosamente' });
                // Return to Muestreos Ejecutados List
                setFichasMode('list_ejecutados');
                setActiveSubmodule('ma-fichas-ingreso'); 
            } else {
                showToast({ type: 'error', message: response.message || 'Error al crear remuestreo' });
            }
        } catch (error) {
            showToast({ type: 'error', message: 'Excepción al crear remuestreo' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <LoadingOverlay visible />;

    return (
        <Box p="md">
            <Stack gap="lg">
                <PageHeader 
                    title="Nuevo Remuestreo"
                    subtitle={`Basado en Ficha N° ${originalFicha?.fichaingresoservicio || '-'}`}
                    onBack={() => setActiveSubmodule('ma-ficha-detalle')}
                    rightSection={
                        <Button 
                            variant="light" 
                            color="gray" 
                            leftSection={<IconX size={18} />} 
                            onClick={() => setActiveSubmodule('ma-ficha-detalle')}
                        >
                            Cancelar
                        </Button>
                    }
                />

                <Alert icon={<IconInfoCircle size={16} />} title="Información de Remuestreo" color="blue" variant="light" radius="md">
                    Se ha pre-llenado la información basándose en la ficha original. Por favor revise y ajuste los datos si es necesario antes de confirmar la creación de la nueva ficha.
                </Alert>

                <Paper withBorder p={0} radius="lg" shadow="sm" style={{ overflow: 'hidden' }}>
                    <Tabs value={activeTab} onChange={(v) => setActiveTab(v || 'antecedentes')} variant="outline" radius="md">
                        <Tabs.List grow>
                            <Tabs.Tab value="antecedentes" leftSection={<IconClipboardList size={20} />} py="md">
                                Antecedentes
                            </Tabs.Tab>
                            <Tabs.Tab value="analisis" leftSection={<IconFlask size={20} />} py="md">
                                Análisis
                            </Tabs.Tab>
                            <Tabs.Tab value="observaciones" leftSection={<IconFileText size={20} />} py="md">
                                Observaciones
                            </Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="antecedentes" p={isMobile ? 'md' : 'xl'} pt="xl">
                            <Stack gap="lg">
                                <AntecedentesForm ref={antecedentesRef} initialData={mappedInitialDataRef.current} />
                                <Group justify="flex-end">
                                    <Button 
                                        rightSection={<IconArrowRight size={18} />} 
                                        color="blue" 
                                        variant="light"
                                        onClick={() => setActiveTab('analisis')}
                                    >
                                        Siguiente
                                    </Button>
                                </Group>
                            </Stack>
                        </Tabs.Panel>

                        <Tabs.Panel value="analisis" p={isMobile ? 'md' : 'xl'} pt="xl">
                            <Stack gap="lg">
                                <AnalysisForm savedAnalysis={analysisList} onSavedAnalysisChange={setAnalysisList} />
                                <Group justify="flex-end">
                                    <Button 
                                        rightSection={<IconArrowRight size={18} />} 
                                        color="blue" 
                                        variant="light"
                                        onClick={() => setActiveTab('observaciones')}
                                    >
                                        Siguiente
                                    </Button>
                                </Group>
                            </Stack>
                        </Tabs.Panel>

                        <Tabs.Panel value="observaciones" p={isMobile ? 'md' : 'xl'} pt="xl">
                            <Stack gap="lg">
                                <ObservacionesForm 
                                    value={observaciones} 
                                    onChange={setObservaciones} 
                                    label="Observaciones del Remuestreo *" 
                                    placeholder="Especifique las observaciones de este remuestreo..."
                                />
                                <Group justify="center">
                                    <Button 
                                        size="lg"
                                        color="grape" 
                                        leftSection={<IconDeviceFloppy size={20} />} 
                                        onClick={handleCreateRemuestreo} 
                                        loading={saving}
                                        disabled={!observaciones.trim()}
                                    >
                                        Crear Ficha de Remuestreo
                                    </Button>
                                </Group>
                            </Stack>
                        </Tabs.Panel>
                    </Tabs>
                </Paper>
            </Stack>
        </Box>
    );
};

export const RemuestreoPage: React.FC = () => {
    return (
        <CatalogosProvider>
            <RemuestreoPageContent />
        </CatalogosProvider>
    );
};
