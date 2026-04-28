import React, { useState } from 'react';
import { 
    Box, 
    SimpleGrid, 
    Card, 
    Text, 
    ThemeIcon, 
    UnstyledButton,
    Badge,
    Group,
    Tabs,
    TextInput,
    rem
} from '@mantine/core';
import { 
    IconBuildingStore, 
    IconBuilding, 
    IconMapPin, 
    IconUser, 
    IconTarget,
    IconFlask,
    IconTable,
    IconHierarchy2,
    IconRun,
    IconChevronRight,
    IconId,
    IconUsers,
    IconBriefcase,
    IconDroplet,
    IconUserCheck,
    IconTruckDelivery,
    IconUserStar,
    IconHistory,
    IconActivity,
    IconDeviceAnalytics,
    IconTool,
    IconRuler2,
    IconMicroscope,
    IconArrowMerge,
    IconWaveSine,
    IconSettings,
    IconLayoutGrid,
    IconSearch,
    IconShield,
    IconBell,
    IconBolt
} from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { MaestroDataManager } from '../components';
import { EmpresaServicioFormView } from '../../medio-ambiente/components/EmpresaServicioFormView';

type MaestroArea = 'general' | 'medio-ambiente' | 'logistica' | 'tecnica' | 'sistema';

interface MaestroConfig {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    description: string;
    tableName: string;
    idName: string;
    area: MaestroArea;
    displayColumn?: string;
    summaryColumns?: string[];
    statusColumn?: string;
    dependsOn?: string;
    lookups?: {
        [fieldName: string]: {
            tableName: string;
            idColumn: string;
            displayColumn: string;
            noCreate?: boolean;
        }
    };
}

interface Props {
    onBack: () => void;
}

export const MaestrosHub: React.FC<Props> = ({ onBack }) => {
    const [selectedMaestro, setSelectedMaestro] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string | null>('general');
    const [hubSearch, setHubSearch] = useState('');

    const MAESTROS_CONFIG: MaestroConfig[] = [
        // AREA: GESTIÓN ORGANIZACIONAL
        { 
            id: 'clientes', 
            label: 'Clientes', 
            icon: <IconBuildingStore size={24} />, 
            color: 'blue',
            description: 'Gestión de empresas mandantes para facturación.',
            tableName: 'mae_empresa',
            idName: 'id_empresa',
            area: 'general',
            displayColumn: 'nombre_empresa',
            summaryColumns: ['nombre_empresa', 'direccion_empresa', 'email_empresa', 'id_empresaservicio'],
            statusColumn: 'habilitado',
            lookups: {
                id_empresaservicio: { tableName: 'mae_empresaservicios', idColumn: 'id_empresaservicio', displayColumn: 'nombre_empresaservicios' }
            }
        },
        { 
            id: 'empresas-servicio', 
            label: 'Empresas de Servicio', 
            icon: <IconBuilding size={24} />, 
            color: 'teal',
            description: 'Empresas que prestan el servicio de muestreo.',
            tableName: 'mae_empresaservicios',
            idName: 'id_empresaservicio',
            area: 'general',
            displayColumn: 'nombre_empresaservicios',
            summaryColumns: ['nombre_empresaservicios', 'email_empresaservicios'],
            statusColumn: 'habilitado'
        },
        { 
            id: 'contactos', 
            label: 'Contactos', 
            icon: <IconUser size={24} />, 
            color: 'indigo',
            description: 'Personas de contacto en empresas mandantes.',
            tableName: 'mae_contacto',
            idName: 'id_contacto',
            area: 'general',
            displayColumn: 'nombre_contacto',
            statusColumn: 'habilitado',
            summaryColumns: ['nombre_contacto', 'email_contacto', 'fono_contacto', 'id_empresa', 'id_empresaservicio', 'id_cargo'],
            lookups: {
                id_empresa: { tableName: 'mae_empresa', idColumn: 'id_empresa', displayColumn: 'nombre_empresa' },
                id_empresaservicio: { tableName: 'mae_empresaservicios', idColumn: 'id_empresaservicio', displayColumn: 'nombre_empresaservicios' },
                id_cargo: { tableName: 'mae_cargo', idColumn: 'id_cargo', displayColumn: 'nombre_cargo' }
            }
        },
        { 
            id: 'cargos', 
            label: 'Cargos', 
            icon: <IconBriefcase size={24} />, 
            color: 'blue',
            description: 'Definición de cargos para el personal.',
            tableName: 'mae_cargo',
            idName: 'id_cargo',
            area: 'general',
            displayColumn: 'nombre_cargo',
            summaryColumns: ['nombre_cargo', 'lab', 'mam', 'obsterreno', 'cliente']
        },
        { 
            id: 'roles', 
            label: 'Roles de Sistema', 
            icon: <IconId size={24} />, 
            color: 'violet',
            description: 'Perfiles y niveles de acceso al sistema.',
            tableName: 'mae_rol',
            idName: 'id_rol',
            area: 'general',
            displayColumn: 'nombre_rol'
        },
        { 
            id: 'usuarios', 
            label: 'Usuarios', 
            icon: <IconUsers size={24} />, 
            color: 'blue',
            description: 'Cuentas de usuario para acceso a la plataforma.',
            tableName: 'mae_usuario',
            idName: 'id_usuario',
            area: 'general',
            displayColumn: 'nombre_usuario',
            statusColumn: 'habilitado',
            summaryColumns: ['nombre_usuario', 'usuario', 'correo_electronico', 'id_cargo', 'id_lugaranalisis'],
            lookups: {
                id_cargo: { tableName: 'mae_cargo', idColumn: 'id_cargo', displayColumn: 'nombre_cargo' },
                id_lugaranalisis: { tableName: 'mae_lugaranalisis', idColumn: 'id_lugaranalisis', displayColumn: 'nombre_lugaranalisis' }
            }
        },

        // AREA: MEDIO AMBIENTE
        { 
            id: 'componentes', 
            label: 'Componentes Ambientales', 
            icon: <IconFlask size={24} />, 
            color: 'green',
            description: 'Matrices ambientales (Agua, RIL, etc).',
            tableName: 'mae_tipomuestra_ma',
            idName: 'id_tipomuestra_ma',
            area: 'medio-ambiente',
            displayColumn: 'nombre_tipomuestra_ma',
            statusColumn: 'habilitado'
        },
        { 
            id: 'subareas', 
            label: 'Sub Áreas', 
            icon: <IconHierarchy2 size={24} />, 
            color: 'cyan',
            description: 'Divisiones por componente ambiental.',
            tableName: 'mae_subarea',
            idName: 'id_subarea',
            area: 'medio-ambiente',
            displayColumn: 'nombre_subarea',
            dependsOn: 'componentes',
            statusColumn: 'activo',
            summaryColumns: ['nombre_subarea', 'id_tipomuestra', 'metodologia'],
            lookups: {
                id_tipomuestra: { tableName: 'mae_tipomuestra_ma', idColumn: 'id_tipomuestra_ma', displayColumn: 'nombre_tipomuestra_ma' }
            }
        },
        { 
            id: 'objetivos', 
            label: 'Objetivos de Muestreo', 
            icon: <IconTarget size={24} />, 
            color: 'red',
            description: 'Finalidades del monitoreo y cumplimiento.',
            tableName: 'mae_objetivomuestreo_ma',
            idName: 'id_objetivomuestreo_ma',
            area: 'medio-ambiente',
            displayColumn: 'nombre_objetivomuestreo_ma',
            statusColumn: 'habilitado'
        },
        { 
            id: 'tipos-muestreo', 
            label: 'Tipos de Muestreo', 
            icon: <IconTable size={24} />, 
            color: 'grape',
            description: 'Modalidades de toma de muestra.',
            tableName: 'mae_tipomuestreo',
            idName: 'id_tipomuestreo',
            area: 'medio-ambiente',
            displayColumn: 'nombre_tipomuestreo'
        },
        { 
            id: 'actividades', 
            label: 'Actividades de Muestreo', 
            icon: <IconRun size={24} />, 
            color: 'pink',
            description: 'Acciones específicas durante el terreno.',
            tableName: 'mae_actividadmuestreo',
            idName: 'id_actividadmuestreo',
            area: 'medio-ambiente',
            displayColumn: 'nombre_actividadmuestreo',
            statusColumn: 'activo'
        },
        { 
            id: 'tipos-descarga', 
            label: 'Tipos de Descarga', 
            icon: <IconDroplet size={24} />, 
            color: 'blue',
            description: 'Categorización de puntos de vertido.',
            tableName: 'mae_tipodescarga',
            idName: 'id_tipodescarga',
            area: 'medio-ambiente',
            displayColumn: 'nombre_tipodescarga'
        },
        { 
            id: 'inspectores', 
            label: 'Inspectores Ambientales', 
            icon: <IconUserCheck size={24} />, 
            color: 'teal',
            description: 'Personal autorizado para inspecciones.',
            tableName: 'mae_inspectorambiental',
            idName: 'id_inspectorambiental',
            area: 'medio-ambiente',
            displayColumn: 'nombre_inspector',
            statusColumn: 'habilitado',
            summaryColumns: ['nombre_inspector', 'rut_inspector', 'cargo', 'direccion']
        },

        // AREA: LOGÍSTICA Y TERRENO
        { 
            id: 'muestreadores', 
            label: 'Muestreadores', 
            icon: <IconTruckDelivery size={24} />, 
            color: 'orange',
            description: 'Técnicos encargados de la toma de muestras.',
            tableName: 'mae_muestreador',
            idName: 'id_muestreador',
            area: 'logistica',
            displayColumn: 'nombre_muestreador',
            statusColumn: 'habilitado',
            summaryColumns: ['nombre_muestreador', 'correo_electronico', 'id_supervisor'],
            lookups: {
                id_supervisor: { tableName: 'mae_muestreador', idColumn: 'id_muestreador', displayColumn: 'nombre_muestreador', noCreate: true }
            }
        },
        { 
            id: 'coordinadores', 
            label: 'Coordinadores', 
            icon: <IconUserStar size={24} />, 
            color: 'yellow',
            description: 'Responsables de la coordinación de terreno.',
            tableName: 'mae_coordinador',
            idName: 'id_coordinador',
            area: 'logistica',
            displayColumn: 'nombre_coordinador',
            statusColumn: 'habilitado',
            summaryColumns: ['nombre_coordinador']
        },
        { 
            id: 'centros', 
            label: 'Fuentes Emisoras (Centros)', 
            icon: <IconMapPin size={24} />, 
            color: 'orange',
            description: 'Puntos de monitoreo específicos por cliente.',
            tableName: 'mae_centro',
            idName: 'id_centro',
            area: 'logistica',
            displayColumn: 'nombre_centro',
            statusColumn: 'vigente',
            summaryColumns: ['codigo_centro', 'nombre_centro', 'ubicacion', 'id_empresa'],
            lookups: {
                id_empresa: { tableName: 'mae_empresa', idColumn: 'id_empresa', displayColumn: 'nombre_empresa' }
            }
        },
        { 
            id: 'modalidades', 
            label: 'Modalidades', 
            icon: <IconLayoutGrid size={24} />, 
            color: 'indigo',
            description: 'Formas de ejecución del servicio.',
            tableName: 'mae_modalidad',
            idName: 'id_modalidad',
            area: 'logistica',
            displayColumn: 'nombre_modalidad'
        },
        { 
            id: 'frecuencias', 
            label: 'Frecuencias de Periodo', 
            icon: <IconHistory size={24} />, 
            color: 'gray',
            description: 'Periodicidades de monitoreo.',
            tableName: 'mae_frecuencia',
            idName: 'id_frecuencia',
            area: 'logistica',
            displayColumn: 'nombre_frecuencia',
            statusColumn: 'habilitado',
            summaryColumns: ['nombre_frecuencia', 'multiplicadopor', 'cantidad', 'dias', 'orden']
        },
        { 
            id: 'estados-muestreo', 
            label: 'Estados de Muestreo', 
            icon: <IconActivity size={24} />, 
            color: 'lime',
            description: 'Ciclo de vida de una muestra.',
            tableName: 'mae_estadomuestreo',
            idName: 'id_estadomuestreo',
            area: 'logistica',
            displayColumn: 'nombre_estadomuestreo',
            statusColumn: 'habilitado',
            summaryColumns: ['nombre_estadomuestreo', 'orden', 'perfil_muestreador', 'perfil_coordinador']
        },

        // AREA: INSTRUMENTAL Y TÉCNICA
        { 
            id: 'equipos', 
            label: 'Equipos', 
            icon: <IconDeviceAnalytics size={24} />, 
            color: 'blue',
            description: 'Inventario de equipos de medición y monitoreo.',
            tableName: 'mae_equipo',
            idName: 'id_equipo',
            area: 'tecnica',
            displayColumn: 'nombre',
            statusColumn: 'habilitado',
            summaryColumns: ['codigo', 'nombre', 'tipoequipo', 'sede', 'id_muestreador'],
            lookups: {
                id_muestreador: { tableName: 'mae_muestreador', idColumn: 'id_muestreador', displayColumn: 'nombre_muestreador' }
            }
        },
        { 
            id: 'instrumentos', 
            label: 'Instrumentos Ambientales', 
            icon: <IconTool size={24} />, 
            color: 'teal',
            description: 'Instrumental específico para análisis ambiental.',
            tableName: 'mae_instrumentoambiental',
            idName: 'id',
            area: 'tecnica',
            displayColumn: 'nombre',
            statusColumn: 'estado',
            summaryColumns: ['nombre']
        },
        { 
            id: 'unidades', 
            label: 'Unidades de Medida', 
            icon: <IconRuler2 size={24} />, 
            color: 'indigo',
            description: 'Estándares de medición del sistema.',
            tableName: 'mae_umedida',
            idName: 'id_umedida',
            area: 'tecnica',
            displayColumn: 'nombre_umedida',
            summaryColumns: ['nombre_umedida']
        },
        { 
            id: 'lugares-analisis', 
            label: 'Lugares de Análisis', 
            icon: <IconMicroscope size={24} />, 
            color: 'cyan',
            description: 'Laboratorios y puntos de procesamiento.',
            tableName: 'mae_lugaranalisis',
            idName: 'id_lugaranalisis',
            area: 'tecnica',
            displayColumn: 'nombre_lugaranalisis',
            statusColumn: 'habilitado',
            summaryColumns: ['nombre_lugaranalisis', 'sigla', 'cod_contable']
        },
        { 
            id: 'formas-canal', 
            label: 'Formas de Canal', 
            icon: <IconArrowMerge size={24} />, 
            color: 'blue',
            description: 'Geometría de canales de vertido.',
            tableName: 'mae_formacanal',
            idName: 'id_formacanal',
            area: 'tecnica',
            displayColumn: 'nombre_formacanal'
        },
        { 
            id: 'dispositivos', 
            label: 'Dispositivos Hidráulicos', 
            icon: <IconWaveSine size={24} />, 
            color: 'blue',
            description: 'Elementos de control hidráulico.',
            tableName: 'mae_dispositivohidraulico',
            idName: 'id_dispositivohidraulico',
            area: 'tecnica',
            displayColumn: 'nombre_dispositivohidraulico'
        },

        // AREA: SISTEMA
        { 
            id: 'tipos-solicitud', 
            label: 'Tipos de Solicitud (URS)', 
            icon: <IconSettings size={24} />, 
            color: 'dark',
            description: 'Configuración de tipos de requerimiento de servicio.',
            tableName: 'mae_solicitud_tipo',
            idName: 'id_tipo',
            area: 'sistema',
            displayColumn: 'nombre',
            statusColumn: 'estado',
            summaryColumns: ['nombre', 'area_destino', 'modulo_destino', 'cod_permiso_crear']
        },
        { 
            id: 'permisos', 
            label: 'Permisos del Sistema', 
            icon: <IconShield size={24} />, 
            color: 'red',
            description: 'Define qué acciones puede realizar cada rol en la plataforma.',
            tableName: 'mae_permiso',
            idName: 'id_permiso',
            area: 'sistema',
            displayColumn: 'nombre',
            summaryColumns: ['codigo', 'nombre', 'modulo', 'submodulo', 'tipo']
        },
        { 
            id: 'notificacion-reglas', 
            label: 'Reglas de Notificación', 
            icon: <IconBell size={24} />, 
            color: 'yellow',
            description: 'Configura cuándo y a quién se envían alertas automáticas.',
            tableName: 'mae_notificacion_regla',
            idName: 'id_regla',
            statusColumn: 'estado',
            area: 'sistema',
            displayColumn: 'codigo_evento',
            summaryColumns: ['codigo_evento', 'id_tipo_solicitud', 'id_usuario_destino', 'id_rol_destino', 'envia_web', 'envia_email'],
            lookups: {
                id_usuario_destino: { tableName: 'mae_usuario', idColumn: 'id_usuario', displayColumn: 'nombre_usuario' },
                id_rol_destino: { tableName: 'mae_rol', idColumn: 'id_rol', displayColumn: 'nombre_rol' },
                id_tipo_solicitud: { tableName: 'mae_solicitud_tipo', idColumn: 'id_tipo', displayColumn: 'nombre' }
            }
        },
        { 
            id: 'eventos-notificacion', 
            label: 'Eventos de Notificación', 
            icon: <IconBolt size={24} />, 
            color: 'orange',
            description: 'Catálogo de eventos del sistema que pueden disparar notificaciones.',
            tableName: 'mae_evento_notificacion',
            idName: 'id_evento',
            area: 'sistema',
            displayColumn: 'codigo_evento',
            summaryColumns: ['codigo_evento', 'descripcion', 'modulo', 'es_transaccional']
        }
    ];

    if (selectedMaestro) {
        const config = MAESTROS_CONFIG.find(m => m.id === selectedMaestro);
        
        // ESPECIALIZADO: Si es Empresa de Servicio, usar el componente premium dedicado
        if (config?.tableName === 'mae_empresaservicios') {
            return (
                <EmpresaServicioFormView 
                    onBack={() => setSelectedMaestro(null)} 
                />
            );
        }

        return (
            <MaestroDataManager 
                config={config!} 
                onBack={() => setSelectedMaestro(null)} 
            />
        );
    }

    const renderGrid = (area: MaestroArea) => {
        const filtered = MAESTROS_CONFIG
            .filter(m => m.area === area)
            .filter(m => !hubSearch || m.label.toLowerCase().includes(hubSearch.toLowerCase()) || m.description.toLowerCase().includes(hubSearch.toLowerCase()));

        if (filtered.length === 0) {
            return (
                <Text c="dimmed" ta="center" mt="xl" py="xl">
                    No se encontraron maestros para "{hubSearch}" en esta área.
                </Text>
            );
        }

        return (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg" mt="xl">
                {filtered.map((m) => (
                <UnstyledButton 
                    key={m.id} 
                    onClick={() => setSelectedMaestro(m.id)}
                    style={{ height: '100%' }}
                >
                    <Card 
                        withBorder 
                        padding="lg" 
                        radius="lg"
                        style={{
                            height: '100%',
                            transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                            cursor: 'pointer',
                            borderTop: `3px solid var(--mantine-color-${m.color}-6)`,
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        className="maestro-card"
                    >
                        {/* Subtle background gradient */}
                        <div style={{
                            position: 'absolute', top: 0, right: 0,
                            width: 120, height: 120, borderRadius: '50%',
                            background: `var(--mantine-color-${m.color}-0)`,
                            transform: 'translate(40px, -40px)',
                            pointerEvents: 'none'
                        }} />

                        <Group justify="space-between" mb="sm" style={{ position: 'relative' }}>
                            <ThemeIcon color={m.color} variant="light" size={48} radius="md">
                                {m.icon}
                            </ThemeIcon>
                            <IconChevronRight size={18} stroke={2} color={`var(--mantine-color-${m.color}-5)`} />
                        </Group>

                        <Text c="gray" fw={800} size="md" mb={4} style={{ position: 'relative' }}>
                            {m.label}
                        </Text>
                        
                        <Text size="sm" c="dimmed" lineClamp={2} mb="md" style={{ minHeight: '2.4rem', position: 'relative' }}>
                            {m.description}
                        </Text>

                        <Group gap="xs" mt="auto" style={{ position: 'relative' }}>
                            <Badge size="xs" color={m.color} variant="light" style={{ textTransform: 'none', fontFamily: 'monospace', fontSize: 10 }}>
                                {m.tableName}
                            </Badge>
                            {m.lookups && Object.keys(m.lookups).length > 0 && (
                                <Badge variant="dot" size="xs" color="blue">
                                    {Object.keys(m.lookups).length} relaci{Object.keys(m.lookups).length === 1 ? 'ón' : 'ones'}
                                </Badge>
                            )}
                            {m.dependsOn && (
                                <Badge variant="dot" size="xs" color="orange">
                                    Jerárquico
                                </Badge>
                            )}
                        </Group>
                    </Card>
                </UnstyledButton>
                ))}
            </SimpleGrid>
        );
    };

    return (
        <Box p="md">
            <PageHeader 
                title="Gestión de Maestros" 
                subtitle="Administración completa de tablas de referencia del ecosistema ADL ONE."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Informática', onClick: onBack },
                    { label: 'Maestros Hub' }
                ]}
            />

            <TextInput
                placeholder="Buscar maestro por nombre o descripción..."
                leftSection={<IconSearch size={16} />}
                value={hubSearch}
                onChange={(e) => setHubSearch(e.currentTarget.value)}
                mt="md"
                size="md"
                radius="md"
                style={{ maxWidth: 450 }}
            />

            <Tabs 
                value={activeTab} 
                onChange={setActiveTab}
                variant="pills"
                mt="xl"
                styles={{
                    tab: {
                        fontWeight: 700,
                        padding: `${rem(10)} ${rem(18)}`,
                        fontSize: rem(13)
                    },
                    list: {
                        backgroundColor: 'var(--mantine-color-gray-1)',
                        borderRadius: rem(12),
                        padding: rem(4),
                        gap: rem(4)
                    }
                }}
            >
                <Tabs.List>
                    <Tabs.Tab value="general" leftSection={<IconUsers size={15} />}>
                        Organización
                    </Tabs.Tab>
                    <Tabs.Tab value="medio-ambiente" leftSection={<IconFlask size={15} />}>
                        Medio Ambiente
                    </Tabs.Tab>
                    <Tabs.Tab value="logistica" leftSection={<IconTruckDelivery size={15} />}>
                        Logística
                    </Tabs.Tab>
                    <Tabs.Tab value="tecnica" leftSection={<IconTool size={15} />}>
                        Técnica
                    </Tabs.Tab>
                    <Tabs.Tab value="sistema" leftSection={<IconSettings size={15} />}>
                        Configuración
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="general">
                    {renderGrid('general')}
                </Tabs.Panel>

                <Tabs.Panel value="medio-ambiente">
                    {renderGrid('medio-ambiente')}
                </Tabs.Panel>

                <Tabs.Panel value="logistica">
                    {renderGrid('logistica')}
                </Tabs.Panel>

                <Tabs.Panel value="tecnica">
                    {renderGrid('tecnica')}
                </Tabs.Panel>

                <Tabs.Panel value="sistema">
                    {renderGrid('sistema')}
                </Tabs.Panel>
            </Tabs>

            <style dangerouslySetInnerHTML={{ __html: `
                .maestro-card:hover {
                    transform: translateY(-6px);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.12);
                }
            `}} />
        </Box>
    );
};
