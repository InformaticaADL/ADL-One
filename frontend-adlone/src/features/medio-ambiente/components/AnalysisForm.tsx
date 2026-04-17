import React, { useState, useEffect } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import { 
    Stack, 
    Group, 
    Text, 
    Paper, 
    Grid, 
    Select, 
    TextInput, 
    Button, 
    Table, 
    Checkbox, 
    ScrollArea, 
    ActionIcon, 
    NumberInput,
    Divider,
    Badge,
    SimpleGrid
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { 
    IconSearch, 
    IconTrash, 
    IconDeviceFloppy, 
    IconCheck, 
    IconX, 
    IconAdjustmentsHorizontal,
    IconTable,
    IconArrowsDownUp
} from '@tabler/icons-react';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';

interface AnalysisFormProps {
    savedAnalysis: any[];
    onSavedAnalysisChange: (newAnalysis: any[]) => void;
}

export const AnalysisForm: React.FC<AnalysisFormProps> = ({ savedAnalysis, onSavedAnalysisChange }) => {
    const { showToast } = useToast();
    const catalogos = useCachedCatalogos();
    const isMobile = useMediaQuery('(max-width: 768px)');

    // ===== ESTADO: Filtros de Búsqueda =====
    const [normativa, setNormativa] = useState<string | null>(null);
    const [referencia, setReferencia] = useState<string | null>(null);
    const [searchText, setSearchText] = useState<string>('');

    // ===== ESTADO: Catálogos =====
    const [normativas, setNormativas] = useState<any[]>([]);
    const [referencias, setReferencias] = useState<any[]>([]);
    const [analysisResults, setAnalysisResults] = useState<any[]>([]);
    const [tiposMuestra] = useState([
        { value: 'Laboratorio', label: 'Laboratorio' },
        { value: 'Terreno', label: 'Terreno' }
    ]);
    const [laboratorios, setLaboratorios] = useState<any[]>([]);
    const [tiposEntrega, setTiposEntrega] = useState<any[]>([]);

    // ===== ESTADO: Configuración =====
    const [tipoMuestra, setTipoMuestra] = useState<string | null>(null);

    // ===== ESTADO: Selección de Análisis =====
    const [selectedAnalysis, setSelectedAnalysis] = useState<Set<string>>(new Set());
    const [tempLabs, setTempLabs] = useState<Record<string, string>>({}); 
    const [tempLabs2, setTempLabs2] = useState<Record<string, string>>({}); 
    const [tempDeliveries, setTempDeliveries] = useState<Record<string, string>>({}); 

    // ===== FUNCIONES: Carga de Catálogos =====
    useEffect(() => {
        loadNormativas();
        loadLaboratorios();
        loadTiposEntrega();
    }, []);

    const loadNormativas = async () => {
        try {
            const data = await catalogos.getNormativas();
            setNormativas(data || []);
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar normativas' });
        }
    };

    const loadLaboratorios = async () => {
        try {
            const data = await catalogos.getLaboratorios();
            setLaboratorios(data || []);
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar laboratorios' });
        }
    };

    const loadTiposEntrega = async () => {
        try {
            const data = await catalogos.getTiposEntrega();
            setTiposEntrega(data || []);
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar tipos de entrega' });
        }
    };

    // ===== FUNCIONES: Cascadas =====
    useEffect(() => {
        if (normativa) {
            loadReferencias(normativa);
            setReferencia(null);
        } else {
            setReferencias([]);
        }
    }, [normativa]);

    useEffect(() => {
        if (normativa && referencia) {
            loadAnalysisResults(normativa, referencia);
        } else {
            setAnalysisResults([]);
            setSelectedAnalysis(new Set());
        }
    }, [normativa, referencia]);

    const loadReferencias = async (normativaId: string) => {
        try {
            const data = await catalogos.getReferenciasByNormativa(normativaId);
            setReferencias(data || []);
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar referencias' });
        }
    };

    const loadAnalysisResults = async (normativaId: string, referenciaId: string) => {
        try {
            const data = await catalogos.getAnalysisByNormativaReferencia(normativaId, referenciaId);
            setAnalysisResults(data || []);
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar análisis' });
        }
    };

    // ===== FUNCIONES: Filtrado =====
    const filteredAnalysis = analysisResults.filter(analysis =>
        analysis.nombre_tecnica?.toLowerCase().includes(searchText.toLowerCase()) ||
        analysis.id_referenciaanalisis?.toString().includes(searchText)
    );

    // ===== FUNCIONES: Selección de Análisis =====
    const handleSelectAll = () => {
        const allIds = new Set(filteredAnalysis.map(a => String(a.id_referenciaanalisis)));
        setSelectedAnalysis(allIds);
    };

    const handleSelectNone = () => {
        setSelectedAnalysis(new Set());
        setTempLabs({});
        setTempLabs2({});
        setTempDeliveries({});
    };

    const handleToggleAnalysis = (id: string) => {
        const idStr = String(id);
        const newSelection = new Set(selectedAnalysis);
        if (newSelection.has(idStr)) {
            newSelection.delete(idStr);
            const newTempLabs = { ...tempLabs };
            delete newTempLabs[idStr];
            setTempLabs(newTempLabs);

            const newTempLabs2 = { ...tempLabs2 };
            delete newTempLabs2[idStr];
            setTempLabs2(newTempLabs2);

            const newTempDeliveries = { ...tempDeliveries };
            delete newTempDeliveries[idStr];
            setTempDeliveries(newTempDeliveries);
        } else {
            newSelection.add(idStr);
            setSearchText('');
        }
        setSelectedAnalysis(newSelection);
    };

    const handleTempLabChange = (analysisId: string, labId: string) => {
        setTempLabs(prev => ({ ...prev, [analysisId]: labId }));
    };

    const handleTempLab2Change = (analysisId: string, labId: string) => {
        setTempLabs2(prev => ({ ...prev, [analysisId]: labId }));
    };

    const handleTempDeliveryChange = (analysisId: string, deliveryId: string) => {
        setTempDeliveries(prev => ({ ...prev, [analysisId]: deliveryId }));
    };

    const handleBulkDeliveryChange = (deliveryId: string) => {
        const newDeliveries = { ...tempDeliveries };
        selectedAnalysis.forEach(id => {
            newDeliveries[id] = deliveryId;
        });
        setTempDeliveries(newDeliveries);
        showToast({ type: 'info', message: 'Tipo de entrega aplicado a todos' });
    };

    const handleBulkLabChange = (labId: string) => {
        const newLabs = { ...tempLabs };
        selectedAnalysis.forEach(id => {
            newLabs[id] = labId;
        });
        setTempLabs(newLabs);
        showToast({ type: 'info', message: 'Laboratorio derivado aplicado a todos' });
    };

    const handleBulkLab2Change = (labId: string) => {
        const newLabs2 = { ...tempLabs2 };
        selectedAnalysis.forEach(id => {
            newLabs2[id] = labId;
        });
        setTempLabs2(newLabs2);
        showToast({ type: 'info', message: 'Laboratorio secundario aplicado a todos' });
    };

    // ===== FUNCIONES: Grabar Análisis =====
    const handleSaveAnalysis = () => {
        if (!normativa || !referencia) {
            showToast({ type: 'warning', message: 'Debes seleccionar una Normativa y Referencia' });
            return;
        }

        if (selectedAnalysis.size === 0) {
            showToast({ type: 'warning', message: 'Debes seleccionar al menos un análisis' });
            return;
        }

        if (!tipoMuestra) {
            showToast({ type: 'warning', message: 'Debes seleccionar el Tipo de Muestra' });
            return;
        }

        if (tipoMuestra === 'Laboratorio') {
            const missingDeliveries = Array.from(selectedAnalysis).filter(id => !tempDeliveries[id]);
            if (missingDeliveries.length > 0) {
                showToast({ type: 'warning', message: `Faltan tipos de entrega por asignar` });
                return;
            }

            const missingLabs = Array.from(selectedAnalysis).filter(id => !tempLabs[id]);
            if (missingLabs.length > 0) {
                showToast({ type: 'warning', message: `Faltan laboratorios por asignar` });
                return;
            }
        }

        const newSavedAnalysis = Array.from(selectedAnalysis).map((id, index) => {
            const analysis = analysisResults.find(a => String(a.id_referenciaanalisis) === id);
            
            let specificDeliveryId = tempDeliveries[id];
            if (tipoMuestra === 'Terreno') {
                const directaOption = tiposEntrega.find((t: any) => t.nombre_tipoentrega && t.nombre_tipoentrega.toUpperCase().includes('DIRECTA'));
                specificDeliveryId = directaOption?.id_tipoentrega || '';
            }
            
            const selectedTipoEntregaObj = tiposEntrega.find((t: any) => String(t.id_tipoentrega) === String(specificDeliveryId));
            
            const specificLabId = tempLabs[id];
            const selectedLabObj = laboratorios.find((l: any) => String(l.id_laboratorioensayo) === String(specificLabId));
            
            const specificLabId2 = tempLabs2[id];
            const selectedLabObj2 = laboratorios.find((l: any) => String(l.id_laboratorioensayo) === String(specificLabId2));

            return {
                ...analysis,
                tipo_analisis: tipoMuestra,
                nombre_tipoentrega: selectedTipoEntregaObj?.nombre_tipoentrega || '',
                uf_individual: 0,
                // Laboratorio 1
                nombre_laboratorioensayo: tipoMuestra === 'Terreno' ? '' : (selectedLabObj?.nombre_laboratorioensayo || ''),
                id_laboratorioensayo: tipoMuestra === 'Terreno' ? 0 : (selectedLabObj?.id_laboratorioensayo || 0),
                // Laboratorio 2
                nombre_laboratorioensayo_2: tipoMuestra === 'Terreno' ? '' : (selectedLabObj2?.nombre_laboratorioensayo || ''),
                id_laboratorioensayo_2: tipoMuestra === 'Terreno' ? 0 : (selectedLabObj2?.id_laboratorioensayo || 0),
                
                item: savedAnalysis.length + index + 1,
                id_tipoentrega: selectedTipoEntregaObj?.id_tipoentrega || specificDeliveryId,
                id_transporte: 0,
                resultado_fecha: '  /  /    ',
                savedId: `${id}-${Date.now()}`
            };
        });

        onSavedAnalysisChange([...savedAnalysis, ...newSavedAnalysis]);
        setSelectedAnalysis(new Set());
        setTempLabs({});
        setTempLabs2({});
        setTempDeliveries({});
        setSearchText('');
        setTipoMuestra(null);

        showToast({ type: 'success', message: `${newSavedAnalysis.length} análisis grabados` });
    };

    const handleUfChange = (savedId: string, newValue: number | string) => {
        const updatedAnalysis = savedAnalysis.map((item: any) => {
            if (item.savedId === savedId) return { ...item, uf_individual: newValue };
            return item;
        });
        onSavedAnalysisChange(updatedAnalysis);
    };

    const handleDeleteSavedAnalysis = (savedId: string) => {
        onSavedAnalysisChange(savedAnalysis.filter((a: any) => a.savedId !== savedId));
        showToast({ type: 'info', message: 'Análisis eliminado' });
    };

    return (
        <Stack gap={isMobile ? "md" : "xl"} p={isMobile ? 0 : "xs"} style={{ width: '100% !important' }}>
            <Paper withBorder p="md" radius="lg" shadow="xs" style={{ width: '100% !important' }}>
                <Grid gutter="xl" grow style={{ width: '100% !important' }}>
                    {/* Búsqueda */}
                    <Grid.Col span={{ base: 12, xl: 6 }}>
                        <Stack gap="md">
                            <Group gap="xs">
                                <IconSearch size={18} color="var(--mantine-color-blue-6)" />
                                <Text fw={700} size="sm" c="blue.7">Búsqueda de Análisis</Text>
                            </Group>

                            <Select 
                                label="Normativa" 
                                placeholder="Seleccione normativa..."
                                data={normativas.map(n => ({ value: String(n.id_normativa), label: n.nombre_normativa }))}
                                value={normativa}
                                onChange={(val) => setNormativa(val || '')}
                                searchable
                                size="sm" radius="md"
                            />

                            <Select 
                                label="Referencia" 
                                placeholder="Seleccione referencia..."
                                data={referencias.map(r => ({ value: String(r.id_normativareferencia), label: r.nombre_normativareferencia }))}
                                value={referencia}
                                onChange={(val) => setReferencia(val || '')}
                                disabled={!normativa}
                                searchable
                                size="sm" radius="md"
                            />

                            <TextInput 
                                label="Buscar Análisis"
                                placeholder="Filtrar por nombre o código..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.currentTarget.value)}
                                disabled={!referencia}
                                size="sm" radius="md"
                                leftSection={<IconSearch size={14} />}
                            />

                            <Group grow>
                                <Button 
                                    variant="light" size="xs" onClick={handleSelectAll} 
                                    disabled={!referencia || filteredAnalysis.length === 0}
                                    leftSection={<IconCheck size={14} />}
                                >
                                    Todos
                                </Button>
                                <Button 
                                    variant="light" color="gray" size="xs" onClick={handleSelectNone} 
                                    disabled={!referencia || selectedAnalysis.size === 0}
                                    leftSection={<IconX size={14} />}
                                >
                                    Ninguno
                                </Button>
                            </Group>

                            <ScrollArea h={300} offsetScrollbars>
                                <Table striped highlightOnHover withTableBorder>
                                    <Table.Thead bg="gray.0" pos="sticky" top={0} style={{ zIndex: 1 }}>
                                        <Table.Tr>
                                            <Table.Th>Análisis</Table.Th>
                                            <Table.Th w={60} ta="center">☑️</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {catalogos.isLoading(`analysis-${normativa}-${referencia}`) ? (
                                            <Table.Tr><Table.Td colSpan={2} ta="center">Cargando...</Table.Td></Table.Tr>
                                        ) : filteredAnalysis.length > 0 ? (
                                            filteredAnalysis.map(analysis => (
                                                <Table.Tr key={analysis.id_referenciaanalisis}>
                                                    <Table.Td fz="xs">{analysis.nombre_tecnica}</Table.Td>
                                                    <Table.Td ta="center">
                                                        <Checkbox 
                                                            checked={selectedAnalysis.has(String(analysis.id_referenciaanalisis))} 
                                                            onChange={() => handleToggleAnalysis(analysis.id_referenciaanalisis)} 
                                                            size="xs"
                                                        />
                                                    </Table.Td>
                                                </Table.Tr>
                                            ))
                                        ) : (
                                            <Table.Tr><Table.Td colSpan={2} ta="center" c="dimmed">{normativa && referencia ? 'Sin resultados' : 'Seleccione criterios'}</Table.Td></Table.Tr>
                                        )}
                                    </Table.Tbody>
                                </Table>
                            </ScrollArea>
                        </Stack>
                    </Grid.Col>

                    {/* Configuración */}
                    <Grid.Col span={{ base: 12, xl: 6 }}>
                        <Stack gap="md" h="100%">
                            <Group gap="xs">
                                <IconAdjustmentsHorizontal size={18} color="var(--mantine-color-grape-6)" />
                                <Text fw={700} size="sm" c="grape.7">Configuración de Análisis</Text>
                            </Group>

                            <Select 
                                label="Tipo de Muestra *"
                                placeholder="OBLIGATORIO"
                                data={tiposMuestra}
                                value={tipoMuestra}
                                onChange={(val) => setTipoMuestra(val || '')}
                                disabled={!referencia}
                                size="sm" radius="md"
                            />

                            {selectedAnalysis.size > 0 && (
                                <>
                                    <Divider label={`Seleccionados (${selectedAnalysis.size})`} labelPosition="center" />
                                    <ScrollArea h={345}>
                                        {isMobile ? (
                                            <Stack gap="xs" pb="md">
                                                {Array.from(selectedAnalysis).map(id => {
                                                    const analysis = analysisResults.find(a => String(a.id_referenciaanalisis) === id);
                                                    return (
                                                        <Paper key={id} withBorder p="sm" radius="md" bg="gray.0">
                                                            <Stack gap="xs">
                                                                <Group justify="space-between" align="center" wrap="nowrap">
                                                                    <Text fz="xs" fw={700} style={{ flex: 1 }} lineClamp={2}>
                                                                        {analysis?.nombre_tecnica || id}
                                                                    </Text>
                                                                    <ActionIcon color="red" variant="subtle" size="sm" onClick={() => handleToggleAnalysis(id)}>
                                                                        <IconTrash size={14} />
                                                                    </ActionIcon>
                                                                </Group>
                                                                
                                                                {tipoMuestra === 'Laboratorio' && (
                                                                    <SimpleGrid cols={1} spacing="xs">
                                                                        <Select 
                                                                            label="Tipo Entrega"
                                                                            data={tiposEntrega.map(t => ({ value: String(t.id_tipoentrega), label: t.nombre_tipoentrega }))}
                                                                            value={tempDeliveries[id] || ''}
                                                                            onChange={(val) => handleTempDeliveryChange(id, val || '')}
                                                                            size="xs" radius="md"
                                                                        />
                                                                        <Select 
                                                                            label="Laboratorio Derivado"
                                                                            data={laboratorios.map(l => ({ value: String(l.id_laboratorioensayo), label: l.nombre_laboratorioensayo }))}
                                                                            value={tempLabs[id] || ''}
                                                                            onChange={(val) => handleTempLabChange(id, val || '')}
                                                                            size="xs" radius="md"
                                                                            placeholder="Seleccione..."
                                                                        />
                                                                        <Select 
                                                                            label="Laboratorio Secundario"
                                                                            data={laboratorios.map(l => ({ value: String(l.id_laboratorioensayo), label: l.nombre_laboratorioensayo }))}
                                                                            value={tempLabs2[id] || ''}
                                                                            onChange={(val) => handleTempLab2Change(id, val || '')}
                                                                            size="xs" radius="md"
                                                                            placeholder="(Opcional)"
                                                                            clearable
                                                                        />
                                                                    </SimpleGrid>
                                                                )}
                                                            </Stack>
                                                        </Paper>
                                                    );
                                                })}
                                            </Stack>
                                        ) : (
                                            <Table border={0} verticalSpacing="sm">
                                                <Table.Thead bg="gray.0" pos="sticky" top={0} style={{ zIndex: 10 }}>
                                                    <Table.Tr>
                                                        <Table.Th>Análisis</Table.Th>
                                                        {tipoMuestra === 'Laboratorio' && (
                                                            <>
                                                                <Table.Th w={160}>Entrega</Table.Th>
                                                                <Table.Th w={180}>Lab. Derivado</Table.Th>
                                                                <Table.Th w={180}>Lab. Secundario</Table.Th>
                                                            </>
                                                        )}
                                                        <Table.Th w={40}></Table.Th>
                                                    </Table.Tr>
                                                    {tipoMuestra === 'Laboratorio' && selectedAnalysis.size > 1 && (
                                                        <Table.Tr bg="blue.0">
                                                            <Table.Td>
                                                                <Group gap={4} wrap="nowrap">
                                                                    <IconArrowsDownUp size={14} color="var(--mantine-color-blue-6)" />
                                                                    <Text size="xs" fw={700} c="blue.7">Aplicar a todos:</Text>
                                                                </Group>
                                                            </Table.Td>
                                                            <Table.Td>
                                                                <SearchableSelect 
                                                                    options={tiposEntrega.map(t => ({ id: t.id_tipoentrega, nombre: t.nombre_tipoentrega }))}
                                                                    value=""
                                                                    placeholder="Seleccionar todos..."
                                                                    onChange={handleBulkDeliveryChange}
                                                                />
                                                            </Table.Td>
                                                            <Table.Td>
                                                                <SearchableSelect 
                                                                    options={laboratorios.map(l => ({ id: l.id_laboratorioensayo, nombre: l.nombre_laboratorioensayo }))}
                                                                    value=""
                                                                    placeholder="Seleccionar todos..."
                                                                    onChange={handleBulkLabChange}
                                                                />
                                                            </Table.Td>
                                                            <Table.Td>
                                                                <SearchableSelect 
                                                                    options={laboratorios.map(l => ({ id: l.id_laboratorioensayo, nombre: l.nombre_laboratorioensayo }))}
                                                                    value=""
                                                                    placeholder="Seleccionar todos..."
                                                                    onChange={handleBulkLab2Change}
                                                                />
                                                            </Table.Td>
                                                            <Table.Td />
                                                        </Table.Tr>
                                                    )}
                                                </Table.Thead>
                                                <Table.Tbody>
                                                    {Array.from(selectedAnalysis).map(id => {
                                                        const analysis = analysisResults.find(a => String(a.id_referenciaanalisis) === id);
                                                        return (
                                                            <Table.Tr key={id}>
                                                                <Table.Td fz="xs" fw={500}>{analysis?.nombre_tecnica || id}</Table.Td>
                                                                {tipoMuestra === 'Laboratorio' && (
                                                                    <>
                                                                        <Table.Td>
                                                                            <SearchableSelect 
                                                                                options={tiposEntrega.map(t => ({ id: t.id_tipoentrega, nombre: t.nombre_tipoentrega }))}
                                                                                value={tempDeliveries[id] || ''}
                                                                                onChange={(val) => handleTempDeliveryChange(id, val)}
                                                                                containerStyle={{ minWidth: '140px' }}
                                                                            />
                                                                        </Table.Td>
                                                                        <Table.Td>
                                                                            <SearchableSelect 
                                                                                options={laboratorios.map(l => ({ id: l.id_laboratorioensayo, nombre: l.nombre_laboratorioensayo }))}
                                                                                value={tempLabs[id] || ''}
                                                                                onChange={(val) => handleTempLabChange(id, val)}
                                                                                placeholder="..."
                                                                            />
                                                                        </Table.Td>
                                                                        <Table.Td>
                                                                            <SearchableSelect 
                                                                                options={laboratorios.map(l => ({ id: l.id_laboratorioensayo, nombre: l.nombre_laboratorioensayo }))}
                                                                                value={tempLabs2[id] || ''}
                                                                                onChange={(val) => handleTempLab2Change(id, val)}
                                                                                placeholder="(Opcional)"
                                                                            />
                                                                        </Table.Td>
                                                                    </>
                                                                )}
                                                                <Table.Td>
                                                                    <ActionIcon color="red" variant="subtle" size="sm" onClick={() => handleToggleAnalysis(id)}>
                                                                        <IconTrash size={14} />
                                                                    </ActionIcon>
                                                                </Table.Td>
                                                            </Table.Tr>
                                                        );
                                                    })}
                                                </Table.Tbody>
                                            </Table>
                                        )}
                                    </ScrollArea>
                                </>
                            )}

                            <Button 
                                color="teal" fullWidth h={44} mt="auto" radius="md"
                                onClick={handleSaveAnalysis}
                                disabled={
                                    selectedAnalysis.size === 0 || !tipoMuestra || 
                                    (tipoMuestra === 'Laboratorio' && (
                                        Array.from(selectedAnalysis).some(id => !tempDeliveries[id]) ||
                                        Array.from(selectedAnalysis).some(id => !tempLabs[id])
                                    ))
                                }
                                leftSection={<IconDeviceFloppy size={20} />}
                            >
                                Grabar Análisis
                            </Button>
                        </Stack>
                    </Grid.Col>
                </Grid>
            </Paper>

            <Paper withBorder p="md" radius="lg" shadow="xs" style={{ width: '100% !important' }}>
                <Stack gap="md" style={{ width: '100% !important' }}>
                    <Group justify="space-between">
                        <Group gap="xs">
                            <IconTable size={18} color="var(--mantine-color-indigo-6)" />
                            <Text fw={700} size="sm" c="indigo.7">Análisis Grabados</Text>
                        </Group>
                        <Badge variant="filled" color="indigo">{savedAnalysis.length}</Badge>
                    </Group>

                    <ScrollArea offsetScrollbars>
                        <Table striped highlightOnHover withTableBorder verticalSpacing="xs">
                            <Table.Thead bg="gray.0" pos="sticky" top={0} style={{ zIndex: 1 }}>
                                <Table.Tr>
                                    <Table.Th>Análisis</Table.Th>
                                    <Table.Th>Muestra</Table.Th>
                                    <Table.Th ta="right">L. Min</Table.Th>
                                    <Table.Th ta="right">L. Max</Table.Th>
                                    <Table.Th ta="center">Error</Table.Th>
                                    <Table.Th ta="right">Err. Min</Table.Th>
                                    <Table.Th ta="right">Err. Max</Table.Th>
                                    <Table.Th>Entrega</Table.Th>
                                    <Table.Th w={100} ta="right">U.F.</Table.Th>
                                    <Table.Th>Lab. Derivado</Table.Th>
                                    <Table.Th>Lab. Secundario</Table.Th>
                                    <Table.Th w={60} ta="center"></Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {savedAnalysis.length > 0 ? (
                                    savedAnalysis.map(analysis => (
                                        <Table.Tr key={analysis.savedId}>
                                            <Table.Td fz="sm" fw={500}>{analysis.nombre_tecnica}</Table.Td>
                                            <Table.Td fz="xs">{analysis.tipo_analisis}</Table.Td>
                                            <Table.Td fz="xs" ta="right">{analysis.limitemax_d ?? '-'}</Table.Td>
                                            <Table.Td fz="xs" ta="right">{analysis.limitemax_h ?? '-'}</Table.Td>
                                            <Table.Td fz="xs" ta="center">{['S', 's', 'Y', 'y', true].includes(analysis.llevaerror) ? 'Sí' : 'No'}</Table.Td>
                                            <Table.Td fz="xs" ta="right">{analysis.error_min ?? '-'}</Table.Td>
                                            <Table.Td fz="xs" ta="right">{analysis.error_max ?? '-'}</Table.Td>
                                            <Table.Td fz="xs">{analysis.nombre_tipoentrega}</Table.Td>
                                            <Table.Td>
                                                <NumberInput 
                                                    size="xs" radius="xs"
                                                    value={analysis.uf_individual} 
                                                    onChange={(val) => handleUfChange(analysis.savedId, val)}
                                                    onFocus={(e) => {
                                                        if (String(analysis.uf_individual) === '0') {
                                                            handleUfChange(analysis.savedId, '');
                                                        }
                                                        e.currentTarget.select();
                                                    }}
                                                    decimalScale={2}
                                                    hideControls
                                                    ta="right"
                                                />
                                            </Table.Td>
                                            <Table.Td fz="xs">{analysis.nombre_laboratorioensayo || '-'}</Table.Td>
                                            <Table.Td fz="xs">{analysis.nombre_laboratorioensayo_2 || '-'}</Table.Td>
                                            <Table.Td ta="center">
                                                <ActionIcon color="red" variant="subtle" size="sm" onClick={() => handleDeleteSavedAnalysis(analysis.savedId)}>
                                                    <IconTrash size={14} />
                                                </ActionIcon>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))
                                ) : (
                                    <Table.Tr><Table.Td colSpan={12} ta="center" py="xl" c="dimmed">No hay análisis grabados</Table.Td></Table.Tr>
                                )}
                            </Table.Tbody>
                        </Table>
                    </ScrollArea>
                </Stack>
            </Paper>
        </Stack>
    );
};
