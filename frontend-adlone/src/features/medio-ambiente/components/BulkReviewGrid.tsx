import React from 'react';
import {
    Table,
    Badge,
    ActionIcon,
    Tooltip,
    Group,
    Text,
    ScrollArea,
    Checkbox,
    Popover,
    Stack,
    Box,
    ThemeIcon,
    Alert,
    Modal,
    Divider,
    Tabs,
    SimpleGrid,
    Paper,
    NumberInput
} from '@mantine/core';
import {
    IconCheck,
    IconAlertTriangle,
    IconX,
    IconInfoCircle,
    IconFlask,
    IconEye,
    IconClipboardList,
    IconCodeDots,
    IconCurrencyDollar
} from '@tabler/icons-react';

interface Props {
    items: any[];
    selectedIndices: number[];
    onSelectChange: (indices: number[]) => void;
    ufTotals: Record<number, number>;
    onUfTotalChange: (index: number, value: number) => void;
}

export const BulkReviewGrid: React.FC<Props> = ({ items, selectedIndices, onSelectChange, ufTotals, onUfTotalChange }) => {
    const [previewItem, setPreviewItem] = React.useState<any>(null);
    const [previewIndex, setPreviewIndex] = React.useState<number>(-1);

    const toggleAll = () => {
        if (selectedIndices.length === items.filter(i => i.status === 'READY' || i.status === 'WARNING').length) {
            onSelectChange([]);
        } else {
            onSelectChange(items.map((item, index) => (item.status === 'READY' || item.status === 'WARNING' ? index : -1)).filter(i => i !== -1));
        }
    };

    const toggleItem = (index: number) => {
        if (selectedIndices.includes(index)) {
            onSelectChange(selectedIndices.filter(i => i !== index));
        } else {
            onSelectChange([...selectedIndices, index]);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'READY': return <ThemeIcon color="green" size="md" variant="light"><IconCheck size={16} /></ThemeIcon>;
            case 'WARNING': return <ThemeIcon color="yellow" size="md" variant="light"><IconAlertTriangle size={16} /></ThemeIcon>;
            case 'ERROR': return <ThemeIcon color="red" size="md" variant="light"><IconX size={16} /></ThemeIcon>;
            default: return null;
        }
    };

    const isAllSelected = items.length > 0 && selectedIndices.length === items.filter(i => i.status === 'READY' || i.status === 'WARNING').length;
    const hasIndeterminate = selectedIndices.length > 0 && !isAllSelected;

    // Calculate UF individual for a given item
    const getUfIndividual = (itemIndex: number, item: any) => {
        const ufTotal = ufTotals[itemIndex] || 0;
        const matchedCount = (item.analisis || []).filter((a: any) => a._matched).length;
        if (ufTotal <= 0 || matchedCount === 0) return 0;
        return Math.round((ufTotal / matchedCount) * 100) / 100; // 2 decimals
    };

    return (
        <>
            <ScrollArea h={500} offsetScrollbars>
            <Table verticalSpacing="sm" highlightOnHover striped withTableBorder>
                <Table.Thead bg="gray.1" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <Table.Tr>
                        <Table.Th w={40}>
                            <Checkbox 
                                checked={isAllSelected}
                                indeterminate={hasIndeterminate}
                                onChange={toggleAll}
                                size="sm"
                            />
                        </Table.Th>
                        <Table.Th w={60}>Estado</Table.Th>
                        <Table.Th w={200}>Archivo</Table.Th>
                        <Table.Th w={160}>Cliente</Table.Th>
                        <Table.Th w={160}>Empresa Srv.</Table.Th>
                        <Table.Th w={150}>Fuente Emisora</Table.Th>
                        <Table.Th w={130}>Objetivo</Table.Th>
                        <Table.Th>Análisis (#)</Table.Th>
                        <Table.Th w={90}>UF Total</Table.Th>
                        <Table.Th w={80}>Problemas</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {items.length === 0 ? (
                        <Table.Tr>
                            <Table.Td colSpan={10} align="center" py="xl">
                                <Text c="dimmed">No hay elementos para mostrar</Text>
                            </Table.Td>
                        </Table.Tr>
                    ) : (
                        items.map((item, idx) => {
                            const ants = item.antecedentes || {};
                            const hasErrors = item.errors?.length > 0 || item.analysisErrors?.length > 0;
                            const hasWarnings = item.warnings?.length > 0;
                            
                            // Analysis parsing info
                            const validAnalyses = item.analisis?.filter((a: any) => a._matched) || [];
                            const totalAnalyses = item.analisis?.length || 0;

                            const canSelect = item.status === 'READY' || item.status === 'WARNING';

                            return (
                                <Table.Tr key={idx} bg={item.status === 'ERROR' ? 'red.0' : undefined}>
                                    <Table.Td>
                                        <Checkbox 
                                            checked={selectedIndices.includes(idx)}
                                            onChange={() => toggleItem(idx)}
                                            size="sm"
                                            disabled={!canSelect}
                                        />
                                    </Table.Td>
                                    <Table.Td align="center">
                                        {getStatusIcon(item.status)}
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap="xs" wrap="nowrap">
                                            <ActionIcon variant="subtle" color="blue" onClick={() => { setPreviewItem(item); setPreviewIndex(idx); }} title="Ver detalles extraídos">
                                                <IconEye size={16} />
                                            </ActionIcon>
                                            <Text size="sm" fw={500} truncate maw={180} title={item.filename}>
                                                {item.filename}
                                            </Text>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs" truncate maw={140} title={ants._clienteNombre || '-'}>
                                            {ants._clienteNombre || <Text span c="red">No encontrado</Text>}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs" truncate maw={140} title={ants._empresaNombre || '-'}>
                                            {ants._empresaNombre || <Text span c="dimmed">-</Text>}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs" truncate maw={130} title={ants._fuenteNombre || '-'}>
                                            {ants._fuenteNombre || <Text span c="red">No encontrado</Text>}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs" truncate maw={120} title={ants._objetivoNombre || '-'}>
                                            {ants._objetivoNombre || <Text span c="dimmed">-</Text>}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap="xs">
                                            <Badge 
                                                variant="light" 
                                                color={totalAnalyses === 0 ? 'red' : (validAnalyses.length === totalAnalyses ? 'blue' : 'orange')}
                                                leftSection={<IconFlask size={12} />}
                                            >
                                                {validAnalyses.length} / {totalAnalyses}
                                            </Badge>
                                            
                                            {item._normativa && (
                                                <Tooltip label={item._normativa}>
                                                    <Badge variant="outline" color="gray" size="sm" maw={150} style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                                        {item._normativa}
                                                    </Badge>
                                                </Tooltip>
                                            )}
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <NumberInput
                                            size="xs"
                                            w={80}
                                            min={0}
                                            step={0.5}
                                            decimalScale={2}
                                            placeholder="0"
                                            value={ufTotals[idx] || ''}
                                            onChange={(val) => onUfTotalChange(idx, Number(val) || 0)}
                                            disabled={!canSelect}
                                            leftSection={<IconCurrencyDollar size={12} />}
                                        />
                                    </Table.Td>
                                    <Table.Td align="center">
                                        {(hasErrors || hasWarnings) ? (
                                            <Popover width={350} position="left" withArrow shadow="md">
                                                <Popover.Target>
                                                    <ActionIcon color={hasErrors ? 'red' : 'yellow'} variant="subtle">
                                                        <IconInfoCircle size={20} />
                                                    </ActionIcon>
                                                </Popover.Target>
                                                <Popover.Dropdown>
                                                    <Stack gap="xs">
                                                        {item.errors?.map((err: any, i: number) => (
                                                            <Alert key={`err-${i}`} variant="light" color="red" title={err.field} icon={<IconX size={16} />}>
                                                                <Text size="xs">{err.message}</Text>
                                                            </Alert>
                                                        ))}
                                                        {item.analysisErrors?.map((errStr: string, i: number) => (
                                                            <Alert key={`aerr-${i}`} variant="light" color="orange" title="Análisis" icon={<IconAlertTriangle size={16} />}>
                                                                <Text size="xs">{errStr}</Text>
                                                            </Alert>
                                                        ))}
                                                        {item.warnings?.map((warn: any, i: number) => (
                                                            <Alert key={`warn-${i}`} variant="light" color="yellow" title={warn.field} icon={<IconAlertTriangle size={16} />}>
                                                                <Text size="xs">{warn.message}</Text>
                                                            </Alert>
                                                        ))}
                                                    </Stack>
                                                </Popover.Dropdown>
                                            </Popover>
                                        ) : (
                                            <Text size="xs" c="dimmed">-</Text>
                                        )}
                                    </Table.Td>
                                </Table.Tr>
                            );
                        })
                    )}
                </Table.Tbody>
            </Table>
        </ScrollArea>

        <Modal 
            opened={!!previewItem} 
            onClose={() => { setPreviewItem(null); setPreviewIndex(-1); }} 
            title={
                <Group>
                    <IconEye size={20} color="var(--mantine-color-blue-6)" />
                    <Text fw={600}>Vista Previa: {previewItem?.filename}</Text>
                </Group>
            }
            size="75%"
            styles={{ body: { padding: 0 } }}
        >
            {previewItem && (
                <Box style={{ width: '100% !important', maxWidth: '100% !important' }}>
                    <Tabs defaultValue="antecedentes" variant="outline" radius="md">
                        <Tabs.List grow p="md" pb={0}>
                            <Tabs.Tab value="antecedentes" leftSection={<IconClipboardList size={18} />}>
                                Antecedentes
                            </Tabs.Tab>
                            <Tabs.Tab value="analisis" leftSection={<IconFlask size={18} />}>
                                Análisis
                            </Tabs.Tab>
                            <Tabs.Tab value="auditoria" leftSection={<IconCodeDots size={18} />}>
                                Auditoría de Match
                            </Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="antecedentes" p="xl" bg="gray.0">
                            <Stack gap="lg">
                                {(() => {
                                    const StaticField = ({ label, value }: { label: string, value: any }) => (
                                        <Stack gap={2}>
                                            <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ whiteSpace: 'nowrap' }} truncate>{label}</Text>
                                            <Paper withBorder p="xs" radius="md" bg="white">
                                                <Text size="sm" fw={500} truncate title={String(value || '-')}>
                                                    {value || '-'}
                                                </Text>
                                            </Paper>
                                        </Stack>
                                    );
                                    
                                    const ants = previewItem.antecedentes || {};
                                    return (
                                        <>
                                            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                                                <StaticField label="Monitoreo" value={ants.tipoMonitoreo} />
                                                <StaticField label="Base Operaciones" value={ants._lugarNombre || 'No Aplica'} />
                                                <StaticField label="Cliente" value={ants._clienteNombre} />
                                                <StaticField label="Empresa Servicio" value={ants._empresaNombre} />
                                            </SimpleGrid>

                                            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                                                <StaticField label="Fuente Emisora" value={ants._fuenteNombre} />
                                                <StaticField label="Comuna" value={ants.comuna} />
                                                <StaticField label="Región" value={ants.region} />
                                                <StaticField label="Tipo Agua" value={ants.tipoAgua} />
                                            </SimpleGrid>

                                            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                                                <StaticField label="Contacto" value={ants.contactoNombre} />
                                                <StaticField label="E-mail" value={ants.contactoEmail} />
                                                <StaticField label="Objetivo" value={ants._objetivoNombre} />
                                                <StaticField label="Ubicación" value={ants.ubicacion} />
                                            </SimpleGrid>

                                            <StaticField label="Tabla / Glosa" value={ants.glosa} />

                                            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                                                <StaticField label="Es ETFA" value={ants.esETFA || (ants.etfa ? 'Sí' : 'No')} />
                                                <StaticField label="Inspector" value={ants._inspectorNombre} />
                                                <StaticField label="Punto de Muestreo" value={ants.puntoMuestreo} />
                                                <StaticField label="Responsable" value={ants.responsableMuestreo} />
                                            </SimpleGrid>

                                            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                                                <StaticField label="Instrumento" value={ants.selectedInstrumento ? `${ants.selectedInstrumento}${ants.nroInstrumento ? ` N° ${ants.nroInstrumento}` : ''}${ants.anioInstrumento ? ` / ${ants.anioInstrumento}` : ''}` : '-'} />
                                                <StaticField label="Ref. Google Maps" value={ants.refGoogle ? '✓ Enlace detectado' : 'Sin enlace'} />
                                                <StaticField label="Zona UTM" value={ants.zona} />
                                                <StaticField label="Coordenadas" value={ants.utmNorte && ants.utmEste ? `N ${ants.utmNorte} / E ${ants.utmEste}` : '-'} />
                                            </SimpleGrid>
                                            
                                            <Divider label="Frecuencia y Programación" labelPosition="center" />
                                            
                                            <SimpleGrid cols={{ base: 1, sm: 4 }}>
                                                <StaticField label="Frecuencia" value={ants.frecuencia} />
                                                <StaticField label="Periodo" value={ants._periodoNombre} />
                                                <StaticField label="Factor" value={ants.factor} />
                                                <StaticField label="Total Servicios" value={ants.totalServicios} />
                                            </SimpleGrid>

                                            <Divider label="Detalles del Servicio" labelPosition="center" />
                                            
                                            <SimpleGrid cols={{ base: 1, sm: 3 }}>
                                                <StaticField label="Componente" value={ants._componenteNombre} />
                                                <StaticField label="Sub Área" value={ants._subAreaNombre} />
                                                <StaticField label="Duración (hrs)" value={ants.duracion} />
                                            </SimpleGrid>

                                            <SimpleGrid cols={{ base: 1, sm: 4 }}>
                                                <StaticField label="Cargo" value={ants.cargoResponsable} />
                                                <StaticField label="Tipo Muestreo" value={ants._tipoMuestreoNombre} />
                                                <StaticField label="Medición Caudal" value={ants.medicionCaudal} />
                                                <StaticField label="Normativa" value={ants._normativaNombre} />
                                            </SimpleGrid>
                                        </>
                                    );
                                })()}
                            </Stack>
                        </Tabs.Panel>

                        <Tabs.Panel value="analisis" p="xl" bg="gray.0">
                            <Stack gap="xl">
                                <Paper withBorder p="md" radius="md" bg="blue.0">
                                    <SimpleGrid cols={{ base: 1, sm: 3 }}>
                                        <Group gap={4}>
                                            <Text size="xs" fw={700} c="dimmed" tt="uppercase">Normativa:</Text>
                                            <Text size="sm" fw={600}>{previewItem._normativa || '-'}</Text>
                                        </Group>
                                        <Group gap={4}>
                                            <Text size="xs" fw={700} c="dimmed" tt="uppercase">Referencia:</Text>
                                            <Text size="sm" fw={600}>{previewItem._normativaRef || '-'}</Text>
                                        </Group>
                                        <Group gap={4} align="center">
                                            <Text size="xs" fw={700} c="dimmed" tt="uppercase">UF Total:</Text>
                                            <NumberInput
                                                size="xs"
                                                w={100}
                                                min={0}
                                                step={0.5}
                                                decimalScale={2}
                                                value={previewIndex >= 0 ? (ufTotals[previewIndex] || '') : ''}
                                                onChange={(val) => { if (previewIndex >= 0) onUfTotalChange(previewIndex, Number(val) || 0); }}
                                                leftSection={<IconCurrencyDollar size={14} />}
                                                placeholder="Ingresar UF"
                                            />
                                            {previewIndex >= 0 && ufTotals[previewIndex] > 0 && (
                                                <Badge color="green" variant="light" size="sm">
                                                    = {getUfIndividual(previewIndex, previewItem)} UF c/u
                                                </Badge>
                                            )}
                                        </Group>
                                    </SimpleGrid>
                                </Paper>

                                <ScrollArea>
                                    <Table striped highlightOnHover withTableBorder>
                                        <Table.Thead bg="gray.1">
                                            <Table.Tr>
                                                <Table.Th>Estado Match</Table.Th>
                                                <Table.Th>Análisis</Table.Th>
                                                <Table.Th>Tipo Muestra</Table.Th>
                                                <Table.Th ta="right">Límite Min</Table.Th>
                                                <Table.Th ta="right">Límite Max</Table.Th>
                                                <Table.Th>Tipo Entrega</Table.Th>
                                                <Table.Th>Lab. Principal</Table.Th>
                                                <Table.Th ta="right">UF Individual</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {previewItem.analisis?.map((row: any, i: number) => {
                                                const ufInd = row._matched && previewIndex >= 0 ? getUfIndividual(previewIndex, previewItem) : 0;
                                                return (
                                                <Table.Tr key={i} bg={!row._matched ? 'orange.0' : undefined}>
                                                    <Table.Td>
                                                        {row._matched ? (
                                                            <Badge color="green" size="xs">OK</Badge>
                                                        ) : (
                                                            <Badge color="red" size="xs">No Encontrado</Badge>
                                                        )}
                                                        {row._errors?.length > 0 && (
                                                            <Tooltip label={row._errors.join(', ')}>
                                                                <IconAlertTriangle size={14} color="var(--mantine-color-red-6)" style={{ marginLeft: 4, cursor: 'help', verticalAlign: 'middle'}} />
                                                            </Tooltip>
                                                        )}
                                                    </Table.Td>
                                                    <Table.Td fw={600} title={row.nombre_original}>
                                                        {row._matched ? row.nombre_original : <Text c="red" span>{row.nombre_original}</Text>}
                                                    </Table.Td>
                                                    <Table.Td>{row.tipo_analisis}</Table.Td>
                                                    <Table.Td ta="right">{row.limitemax_d}</Table.Td>
                                                    <Table.Td ta="right">{row.limitemax_h}</Table.Td>
                                                    <Table.Td>{row.tipo_entrega_texto}</Table.Td>
                                                    <Table.Td>{row.laboratorio_texto}</Table.Td>
                                                    <Table.Td ta="right" fw={600} c={ufInd > 0 ? 'green.7' : 'dimmed'}>
                                                        {ufInd > 0 ? ufInd.toFixed(2) : '-'}
                                                    </Table.Td>
                                                </Table.Tr>
                                                );
                                            })}
                                        </Table.Tbody>
                                    </Table>
                                </ScrollArea>
                            </Stack>
                        </Tabs.Panel>

                        <Tabs.Panel value="auditoria" p="xl">
                            <Box mt="md">
                                <Text size="xs" fw={700} c="dimmed" mb={4}>MODO DESARROLLADOR: AUDITORÍA DE EXTRACCIÓN Y MATCH</Text>
                                <SimpleGrid cols={3} mb="xs">
                                    <Box>
                                        <Text size="10px" fw={600}>Cliente Match</Text>
                                        <Badge size="xs" variant="outline">{previewItem.antecedentes?._clienteMatch_method || 'fuzzy'}</Badge>
                                    </Box>
                                    <Box>
                                        <Text size="10px" fw={600}>Fuente Match</Text>
                                        <Badge size="xs" variant="outline">{previewItem.antecedentes?._fuenteMatch_method || 'fuzzy'}</Badge>
                                    </Box>
                                    <Box>
                                        <Text size="10px" fw={600}>Sede Match</Text>
                                        <Badge size="xs" variant="outline">{previewItem.antecedentes?._lugarMatch_method || 'fuzzy'}</Badge>
                                    </Box>
                                </SimpleGrid>
                                <ScrollArea type="always" h={300}>
                                    <pre style={{ 
                                        backgroundColor: '#f8f9fa', 
                                        padding: '10px', 
                                        borderRadius: '4px', 
                                        fontSize: '11px',
                                        border: '1px solid #e9ecef',
                                        margin: 0
                                    }}>
                                        {JSON.stringify(
                                            {
                                                insert_payload: {
                                                    encabezado: previewItem.antecedentes,
                                                    analisis: previewItem.analisis.map((a:any) => ({
                                                        ra_id: a.id_referenciaanalisis,
                                                        tec_id: a.id_tecnica,
                                                        lab_id: a.id_laboratorioensayo,
                                                        tipo: a.tipo_analisis
                                                    }))
                                                }
                                            }, 
                                        null, 2)}
                                    </pre>
                                </ScrollArea>
                            </Box>
                        </Tabs.Panel>
                    </Tabs>
                </Box>
            )}
        </Modal>
    </>
    );
};
