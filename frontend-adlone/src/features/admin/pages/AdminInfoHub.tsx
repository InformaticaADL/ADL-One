import React, { useState } from 'react';
import { 
    Stack, 
    Group, 
    Text, 
    SimpleGrid, 
    Paper, 
    UnstyledButton, 
    ThemeIcon, 
    Box, 
    Button, 
    Select, 
    Grid
} from '@mantine/core';
import { 
    IconDownload, 
    IconDatabase, 
    IconLayoutGrid,
    IconSettings,
    IconFileSpreadsheet,
    IconChevronRight
} from '@tabler/icons-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { adminExportService } from '../services/admin.service';
import { EquipoCatalogoView } from '../components/EquipoCatalogoView';
import { PageHeader } from '../../../components/layout/PageHeader';

// List of areas with specific permissions
const AREAS: { id: string, label: string, icon: string, permission: string | string[], description?: string }[] = [
    { id: 'gem', label: 'Ensayo Molecular', icon: '🧬', permission: 'GEM_ACCESO', description: 'Gestión de Ensayos Moleculares' },
    { id: 'necropsia', label: 'Necropsia', icon: '🐟', permission: 'NEC_ACCESO', description: 'Área de Anatomía Patológica' },
    { id: 'microscopia', label: 'Microscopía', icon: '🔬', permission: 'MIC_ACCESO', description: 'Análisis Microscópico Digital' },
    { id: 'biologia_molecular', label: 'Biología Molecular', icon: '🧪', permission: 'BM_ACCESO', description: 'Laboratorio de Genética' },
    { id: 'cultivo_celular', label: 'Cultivo Celular', icon: '🧫', permission: 'CC_ACCESO', description: 'Mantenimiento de Líneas Celulares' },
    { id: 'bacteriologia', label: 'Bacteriología', icon: '🦠', permission: 'BAC_ACCESO', description: 'Identificación de Microorganismos' },
    { id: 'screening', label: 'Screening', icon: '🔎', permission: 'SCR_ACCESO', description: 'Tamizaje y Pruebas Rápidas' },
    { id: 'derivaciones', label: 'Derivaciones', icon: '📬', permission: 'DER_ACCESO', description: 'Gestión de Muestras Externas' },
    { id: 'medio_ambiente', label: 'Medioambiente', icon: '🌿', permission: 'MA_ACCESO', description: 'Control Ambiental y Sanitario' },
    { id: 'atl', label: 'Área Técnica Local', icon: '⚖️', permission: 'ATL_ACCESO', description: 'Área Técnica Local' },
    { id: 'id', label: 'Investigación + D', icon: '💡', permission: 'ID_ACCESO', description: 'Innovación y Desarrollo' },
    { id: 'pve', label: 'Vigilancia Epi.', icon: '🩺', permission: 'PVE_ACCESO', description: 'Vigilancia Epidemiológica' },
    { id: 'informatica', label: 'Informática', icon: '💻', permission: 'INF_ACCESO', description: 'Infraestructura y Sistemas' },
    { id: 'comercial', label: 'Comercial', icon: '📈', permission: 'COM_ACCESO', description: 'Gestión de Clientes y Ventas' },
    { id: 'gestion_calidad', label: 'Gestión de Calidad', icon: '⭐', permission: 'GC_ACCESO', description: 'Normativas y Auditorías' },
    { id: 'administracion', label: 'Administración', icon: '🏢', permission: 'ADM_ACCESO', description: 'Gestión General de Oficina' },
];

const TABLES_TO_EXPORT = [
    // --- MAESTROS (GRAL) ---
    { id: 'mae_empresaservicios', label: 'Empresas de Servicios', type: 'TABLE', area: 'Maestros (Gral)' },
    { id: 'mae_empresa', label: 'Maestro de Empresas', type: 'TABLE', area: 'Maestros (Gral)' },
    { id: 'mae_cargo', label: 'Cargos y Funciones', type: 'TABLE', area: 'Maestros (Gral)' },
    { id: 'mae_umedida', label: 'Unidades de Medida', type: 'TABLE', area: 'Maestros (Gral)' },
    { id: 'consulta_contacto_una_empresa', label: 'Contactos por Empresa', type: 'SP', area: 'Maestros (Gral)' },
    { id: 'App_Ma_FichaIngresoServicio_ENC', label: 'Registro de Fichas (MA)', type: 'TABLE', area: 'Fichas e Ingresos' },
    { id: 'consulta_centro', label: 'Centros de Cultivo/Operación', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'consulta_objetivomuestreo_ma_oservicios', label: 'Objetivos de Muestreo', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'consulta_tipomuestreo_medio_ambiente', label: 'Tipos de Muestreo (MA)', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'mae_muestreador', label: 'Maestro de Muestreadores', type: 'TABLE', area: 'Solicitudes y Muestreo' },
    { id: 'mae_equipo', label: 'Inventario de Equipos (Vigencia)', type: 'TABLE', area: 'Calidad y Equipos' },
    { id: 'mae_equipo_historial', label: 'Historial de Cambios (Equipos)', type: 'TABLE', area: 'Calidad y Equipos' },
    { id: 'mae_solicitud_equipo', label: 'Solicitudes de Gestión (Auditoría)', type: 'TABLE', area: 'Calidad y Equipos' },
];

interface Props {
    onNavigate: (areaId: string) => void;
}

export const AdminInfoHub: React.FC<Props> = ({ onNavigate }) => {
    const { hasPermission, user } = useAuth();
    const [currentView, setCurrentView] = useState<'grid' | 'export' | 'catalogo'>('grid');
    const [selectedArea, setSelectedArea] = useState<string>(TABLES_TO_EXPORT[0].area);
    const [selectedId, setSelectedId] = useState(TABLES_TO_EXPORT[0].id);
    const [exporting, setExporting] = useState(false);

    const activeExport = TABLES_TO_EXPORT.find(t => t.id === selectedId);
    const areas = Array.from(new Set(TABLES_TO_EXPORT.map(t => t.area)));
    
    const visibleAreas = AREAS.filter(area => {
        if (hasPermission('AI_MA_ADMIN_ACCESO')) return true;
        if (Array.isArray(area.permission)) {
            return area.permission.some(p => hasPermission(p));
        }
        return hasPermission(area.permission);
    });

    const handleExport = async () => {
        if (exporting || !activeExport) return;
        setExporting(true);
        try {
            const params: any = {};
            const response = await adminExportService.getExportTableData(activeExport.id, activeExport.type as any, params);
            if (response.success && response.data) {
                const worksheet = XLSX.utils.json_to_sheet(response.data);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
                XLSX.writeFile(workbook, `${activeExport.id}_${new Date().toISOString().split('T')[0]}.xlsx`);
            }
        } catch (error: any) {
            console.error('Export error:', error);
        } finally {
            setExporting(false);
        }
    };

    const isRdiaz = user?.username?.toLowerCase() === 'rdiaz' || user?.name?.toLowerCase().includes('diaz');

    if (currentView === 'catalogo') {
        return <EquipoCatalogoView onBack={() => setCurrentView('grid')} />;
    }

    return (
        <Box p="md" style={{ width: '100%' }}>
            <PageHeader
                title={currentView === 'export' ? 'Centro de Exportación' : 'Admin. Info'}
                subtitle={currentView === 'export' 
                    ? 'Genera reportes en formato Excel de las bases maestras del sistema.' 
                    : 'Selecciona un módulo para gestionar su información o utiliza las herramientas globales.'}
                onBack={currentView === 'export' ? () => setCurrentView('grid') : undefined}
                rightSection={currentView === 'grid' ? (
                    <Group>
                        {(isRdiaz || hasPermission('AI_MA_ADMIN_ACCESO')) && (
                            <Button 
                                variant="light" 
                                color="blue"
                                leftSection={<IconSettings size={18} />}
                                onClick={() => setCurrentView('catalogo')}
                                radius="md"
                            >
                                Catálogo Maestro
                            </Button>
                        )}
                        {isRdiaz && (
                            <Button 
                                variant="filled" 
                                color="green"
                                leftSection={<IconDownload size={18} />}
                                onClick={() => setCurrentView('export')}
                                radius="md"
                            >
                                Exportar Datos
                            </Button>
                        )}
                    </Group>
                ) : null}
            />

            <Stack gap="lg" mt="xl">
                {currentView === 'grid' ? (
                    <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, md: 4 }} spacing="lg">
                        {visibleAreas.map((area) => (
                            <UnstyledButton
                                key={area.id}
                                onClick={() => onNavigate(area.id)}
                            >
                                <Paper 
                                    withBorder 
                                    p="lg" 
                                    radius="lg" 
                                    shadow="sm"
                                    style={{ 
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s ease',
                                        cursor: 'pointer',
                                        minHeight: 180,
                                        '&:hover': {
                                            transform: 'translateY(-5px)',
                                            borderColor: 'var(--mantine-color-blue-filled)',
                                            backgroundColor: 'var(--mantine-color-blue-0)'
                                        }
                                    }}
                                >
                                    <Box mb="md" style={{ fontSize: '2.5rem' }}>
                                        {area.icon}
                                    </Box>
                                    <Text fw={800} ta="center" size="lg" c="dark.4">{area.label}</Text>
                                    <Text size="xs" ta="center" c="dimmed" mt={4}>{area.description}</Text>
                                    <Box mt="md" c="blue" display="flex" style={{ alignItems: 'center', gap: 4 }}>
                                        <Text size="xs" fw={700}>Acceder</Text>
                                        <IconChevronRight size={12} />
                                    </Box>
                                </Paper>
                            </UnstyledButton>
                        ))}
                    </SimpleGrid>
                ) : (
                    <Paper withBorder p="xl" radius="lg" shadow="sm">
                        <Stack gap="xl">
                            <Grid grow gutter="lg">
                                <Grid.Col span={{ base: 12, md: 6 }}>
                                    <Select 
                                        label="1. Área de Negocio"
                                        placeholder="Seleccione área"
                                        data={areas}
                                        value={selectedArea}
                                        onChange={(val) => {
                                            setSelectedArea(val!);
                                            const firstInArea = TABLES_TO_EXPORT.find(t => t.area === val);
                                            if (firstInArea) setSelectedId(firstInArea.id);
                                        }}
                                        radius="md"
                                        leftSection={<IconLayoutGrid size={16} />}
                                    />
                                </Grid.Col>
                                <Grid.Col span={{ base: 12, md: 6 }}>
                                    <Select 
                                        label="2. Recurso / Tabla"
                                        placeholder="Seleccione recurso"
                                        data={TABLES_TO_EXPORT.filter(t => t.area === selectedArea).map(t => ({
                                            value: t.id,
                                            label: t.label
                                        }))}
                                        value={selectedId}
                                        onChange={(val) => setSelectedId(val!)}
                                        radius="md"
                                        leftSection={<IconDatabase size={16} />}
                                    />
                                </Grid.Col>
                            </Grid>

                            <Paper withBorder p="md" radius="md" bg="blue.0">
                                <Group justify="space-between" wrap="nowrap">
                                    <Group gap="md" wrap="nowrap">
                                        <ThemeIcon size="xl" radius="md" color="blue" variant="light">
                                            <IconFileSpreadsheet size={24} />
                                        </ThemeIcon>
                                        <Box>
                                            <Text fw={700} size="sm" c="blue.9">Recurso: {activeExport?.label}</Text>
                                            <Text size="xs" c="blue.7">Se generará un archivo Excel (.xlsx) con los datos del servidor.</Text>
                                        </Box>
                                    </Group>
                                    <Button 
                                        color="green" 
                                        radius="md" 
                                        onClick={handleExport}
                                        loading={exporting}
                                        leftSection={<IconDownload size={18} />}
                                    >
                                        Generar Reporte
                                    </Button>
                                </Group>
                            </Paper>
                        </Stack>
                    </Paper>
                )}
            </Stack>
        </Box>
    );
};
