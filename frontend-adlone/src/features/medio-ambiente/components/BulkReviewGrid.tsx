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
    Grid,
    Divider
} from '@mantine/core';
import {
    IconCheck,
    IconAlertTriangle,
    IconX,
    IconInfoCircle,
    IconFlask,
    IconEye
} from '@tabler/icons-react';

interface Props {
    items: any[];
    selectedIndices: number[];
    onSelectChange: (indices: number[]) => void;
}

export const BulkReviewGrid: React.FC<Props> = ({ items, selectedIndices, onSelectChange }) => {
    const [previewItem, setPreviewItem] = React.useState<any>(null);
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
                        <Table.Th w={180}>Cliente</Table.Th>
                        <Table.Th w={180}>Fuente Emisora</Table.Th>
                        <Table.Th>Análisis (#)</Table.Th>
                        <Table.Th w={80}>Problemas</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {items.length === 0 ? (
                        <Table.Tr>
                            <Table.Td colSpan={7} align="center" py="xl">
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
                                            <ActionIcon variant="subtle" color="blue" onClick={() => setPreviewItem(item)} title="Ver detalles extraídos">
                                                <IconEye size={16} />
                                            </ActionIcon>
                                            <Text size="sm" fw={500} truncate maw={180} title={item.filename}>
                                                {item.filename}
                                            </Text>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs" truncate maw={160} title={ants._clienteNombre || '-'}>
                                            {ants._clienteNombre || <Text span c="red">No encontrado</Text>}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs" truncate maw={160} title={ants._fuenteNombre || '-'}>
                                            {ants._fuenteNombre || <Text span c="red">No encontrado</Text>}
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
            onClose={() => setPreviewItem(null)} 
            title={
                <Group>
                    <IconEye size={20} color="var(--mantine-color-blue-6)" />
                    <Text fw={600}>Vista Previa: {previewItem?.filename}</Text>
                </Group>
            }
            size="xl"
        >
            {previewItem && (
                <Stack>
                    <Grid>
                        <Grid.Col span={4}>
                            <Text size="sm" fw={600} c="dimmed">Empresa / Cliente</Text>
                            <Text size="sm">{previewItem.antecedentes?._clienteNombre || 'N/A'}</Text>
                        </Grid.Col>
                        <Grid.Col span={4}>
                            <Text size="sm" fw={600} c="dimmed">Fuente Emisora</Text>
                            <Text size="sm">{previewItem.antecedentes?._fuenteNombre || 'N/A'}</Text>
                        </Grid.Col>
                        <Grid.Col span={4}>
                            <Text size="sm" fw={600} c="dimmed">Normativa</Text>
                            <Text size="sm">{previewItem._normativa || 'N/A'}</Text>
                        </Grid.Col>
                        
                        <Grid.Col span={4}>
                            <Text size="sm" fw={600} c="dimmed">Tipo Muestreo</Text>
                            <Text size="sm">{previewItem.antecedentes?._tipoMuestreoNombre || 'N/A'} - {previewItem.antecedentes?.tipoMonitoreo || ''}</Text>
                        </Grid.Col>
                        <Grid.Col span={4}>
                            <Text size="sm" fw={600} c="dimmed">Inspector</Text>
                            <Text size="sm">{previewItem.antecedentes?._inspectorNombre || 'N/A'}</Text>
                        </Grid.Col>
                        <Grid.Col span={4}>
                            <Text size="sm" fw={600} c="dimmed">Frecuencia / Total</Text>
                            <Text size="sm">{previewItem.antecedentes?.frecuencia || 1} x {previewItem.antecedentes?.factor || 1} = {previewItem.antecedentes?.totalServicios || 1}</Text>
                        </Grid.Col>
                    </Grid>

                    <Divider my="sm" />

                    <Text size="sm" fw={600} c="dimmed">Lista de Análisis Detectados ({previewItem.analisis?.length || 0})</Text>
                    <Table size="xs" striped withTableBorder>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Nombre (PDF)</Table.Th>
                                <Table.Th>Tipo</Table.Th>
                                <Table.Th>Laboratorio (PDF)</Table.Th>
                                <Table.Th>Mapeo en BD</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {previewItem.analisis?.map((an: any, i: number) => (
                                <Table.Tr key={i} bg={!an._matched ? 'orange.1' : undefined}>
                                    <Table.Td>{an.nombre_original}</Table.Td>
                                    <Table.Td>{an.tipo_analisis}</Table.Td>
                                    <Table.Td>{an.laboratorio_texto}</Table.Td>
                                    <Table.Td>
                                        {an._matched ? (
                                            <Badge color="green" size="xs">OK: ID {an.id_referenciaanalisis}</Badge>
                                        ) : (
                                            <Badge color="red" size="xs">No encontrado</Badge>
                                        )}
                                        {an._errors?.length > 0 && (
                                            <Tooltip label={an._errors.join(', ')}>
                                                <IconAlertTriangle size={12} color="red" style={{ marginLeft: 4, cursor: 'help'}} />
                                            </Tooltip>
                                        )}
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>

                    <Box mt="md">
                        <Text size="xs" fw={700} c="dimmed" mb={4}>MODO DESARROLLADOR: AUDITORÍA DE EXTRACCIÓN</Text>
                        <Grid mb="xs">
                            <Grid.Col span={4}>
                                <Text size="10px" fw={600}>Cliente Match</Text>
                                <Badge size="xs" variant="outline">{previewItem.antecedentes?._clienteMatch_method || 'fuzzy'}</Badge>
                            </Grid.Col>
                            <Grid.Col span={4}>
                                <Text size="10px" fw={600}>Fuente Match</Text>
                                <Badge size="xs" variant="outline">{previewItem.antecedentes?._fuenteMatch_method || 'fuzzy'}</Badge>
                            </Grid.Col>
                            <Grid.Col span={4}>
                                <Text size="10px" fw={600}>Sede Match</Text>
                                <Badge size="xs" variant="outline">{previewItem.antecedentes?._lugarMatch_method || 'fuzzy'}</Badge>
                            </Grid.Col>
                        </Grid>
                        <ScrollArea type="always" h={200}>
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

                </Stack>
            )}
        </Modal>
    </>
    );
};
