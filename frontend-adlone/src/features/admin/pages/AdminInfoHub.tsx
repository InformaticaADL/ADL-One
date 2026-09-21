import React, { useMemo, useState } from 'react';
import {
    IconDownload,
    IconSettings,
    IconFileSpreadsheet,
    IconChevronRight,
    IconSearch,
    IconDna2,
    IconFish,
    IconMicroscope,
    IconTestPipe,
    IconFlask,
    IconBug,
    IconMailForward,
    IconLeaf,
    IconScale,
    IconBulb,
    IconActivity,
    IconDeviceDesktop,
    IconChartLine,
    IconAward,
    IconBuildingBank,
    type Icon,
} from '@tabler/icons-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { adminExportService } from '../services/admin.service';
import { EquipoCatalogoView } from '../components/EquipoCatalogoView';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Grupos con sentido operativo (laboratorios/áreas técnicas vs. gestión y
// soporte) en vez de un grid plano — deja que la lista escale a más áreas
// sin volverse una pared de tarjetas iguales, y el ícono de marca (Tabler)
// reemplaza el emoji, que no se ve consistente entre plataformas/SO.
interface AdminArea {
    id: string;
    label: string;
    icon: Icon;
    permission: string | string[];
    description?: string;
    /** Sin página real todavía (DashboardPage no la enruta) — se muestra
     * atenuada, sin acción, con badge "Próximamente" en vez de sacarla del
     * menú. Por defecto true (toda área nueva se asume habilitada). */
    enabled?: boolean;
}

const AREA_GROUPS: { title: string; areas: AdminArea[] }[] = [
    {
        title: 'Laboratorios y áreas técnicas',
        areas: [
            { id: 'gem', label: 'Ensayo Molecular', icon: IconDna2, permission: 'GEM_ACCESO', description: 'Gestión de Ensayos Moleculares', enabled: false },
            { id: 'necropsia', label: 'Necropsia', icon: IconFish, permission: 'NEC_ACCESO', description: 'Área de Anatomía Patológica', enabled: false },
            { id: 'microscopia', label: 'Microscopía', icon: IconMicroscope, permission: 'MIC_ACCESO', description: 'Análisis Microscópico Digital', enabled: false },
            { id: 'biologia_molecular', label: 'Biología Molecular', icon: IconTestPipe, permission: 'BM_ACCESO', description: 'Laboratorio de Genética', enabled: false },
            { id: 'cultivo_celular', label: 'Cultivo Celular', icon: IconFlask, permission: 'CC_ACCESO', description: 'Mantenimiento de Líneas Celulares', enabled: false },
            { id: 'bacteriologia', label: 'Bacteriología', icon: IconBug, permission: 'BAC_ACCESO', description: 'Identificación de Microorganismos', enabled: false },
            { id: 'screening', label: 'Screening', icon: IconSearch, permission: 'SCR_ACCESO', description: 'Tamizaje y Pruebas Rápidas', enabled: false },
            { id: 'derivaciones', label: 'Derivaciones', icon: IconMailForward, permission: 'DER_ACCESO', description: 'Gestión de Muestras Externas', enabled: false },
            { id: 'medio_ambiente', label: 'Medioambiente', icon: IconLeaf, permission: 'MA_ACCESO', description: 'Control Ambiental y Sanitario' },
            { id: 'atl', label: 'Área Técnica Local', icon: IconScale, permission: 'ATL_ACCESO', description: 'Área Técnica Local', enabled: false },
            { id: 'id', label: 'Investigación + D', icon: IconBulb, permission: 'ID_ACCESO', description: 'Innovación y Desarrollo', enabled: false },
            { id: 'pve', label: 'Vigilancia Epi.', icon: IconActivity, permission: 'PVE_ACCESO', description: 'Vigilancia Epidemiológica', enabled: false },
        ],
    },
    {
        title: 'Gestión y soporte',
        areas: [
            { id: 'informatica', label: 'Informática', icon: IconDeviceDesktop, permission: 'INF_ACCESO', description: 'Infraestructura y Sistemas' },
            { id: 'comercial', label: 'Comercial', icon: IconChartLine, permission: 'COM_ACCESO', description: 'Gestión de Clientes y Ventas', enabled: false },
            { id: 'gestion_calidad', label: 'Gestión de Calidad', icon: IconAward, permission: 'GC_ACCESO', description: 'Normativas y Auditorías' },
            { id: 'administracion', label: 'Administración', icon: IconBuildingBank, permission: 'ADM_ACCESO', description: 'Gestión General de Oficina', enabled: false },
        ],
    },
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
    const [search, setSearch] = useState('');

    const activeExport = TABLES_TO_EXPORT.find(t => t.id === selectedId);
    const areas = Array.from(new Set(TABLES_TO_EXPORT.map(t => t.area)));

    const canAccessArea = (area: { permission: string | string[] }) =>
        // RB-08: AI_MA_ADMIN_ACCESO eliminado
        Array.isArray(area.permission) ? area.permission.some(p => hasPermission(p)) : hasPermission(area.permission);

    const q = search.trim().toLowerCase();
    const visibleGroups = useMemo(() => AREA_GROUPS
        .map(group => ({
            ...group,
            areas: group.areas.filter(area =>
                canAccessArea(area) && (!q || area.label.toLowerCase().includes(q) || area.description?.toLowerCase().includes(q))
            ),
        }))
        .filter(group => group.areas.length > 0),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [q, hasPermission]);

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
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title={currentView === 'export' ? 'Centro de Exportación' : 'Admin. Info'}
                subtitle={currentView === 'export'
                    ? 'Genera reportes en formato Excel de las bases maestras del sistema.'
                    : 'Selecciona un módulo para gestionar su información o utiliza las herramientas globales.'}
                onBack={currentView === 'export' ? () => setCurrentView('grid') : undefined}
                breadcrumbItems={currentView === 'export'
                    ? [{ label: 'Admin. Info', onClick: () => setCurrentView('grid') }, { label: 'Centro de Exportación' }]
                    : undefined}
                rightSection={currentView === 'grid' ? (
                    <div className="flex gap-2">
                        {/* RB-08: AI_MA_ADMIN_ACCESO eliminado */}
                        {isRdiaz && (
                            <Button variant="outline" onClick={() => setCurrentView('catalogo')}>
                                <IconSettings size={16} />
                                Catálogo Maestro
                            </Button>
                        )}
                        {isRdiaz && (
                            <Button onClick={() => setCurrentView('export')}>
                                <IconDownload size={16} />
                                Exportar Datos
                            </Button>
                        )}
                    </div>
                ) : null}
            />

            <div className="mt-6 flex flex-col gap-6">
                {currentView === 'grid' ? (
                    <div className="flex flex-col gap-6">
                        <div className="relative max-w-sm">
                            <IconSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Buscar área..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {visibleGroups.length === 0 && (
                            <p className="py-8 text-center text-sm text-muted-foreground">Sin resultados para "{search}".</p>
                        )}

                        {visibleGroups.map((group) => (
                            <div key={group.title}>
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
                                <Card className="divide-y divide-border overflow-hidden p-0">
                                    {group.areas.map((area) => {
                                        const Icon = area.icon;
                                        const disabled = area.enabled === false;
                                        return (
                                            <button
                                                key={area.id}
                                                type="button"
                                                disabled={disabled}
                                                onClick={() => onNavigate(area.id)}
                                                className={cn(
                                                    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                                                    disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted'
                                                )}
                                            >
                                                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', disabled ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary')}>
                                                    <Icon size={19} stroke={1.75} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                                                        {area.label}
                                                        {disabled && <Badge variant="outline" className="font-normal normal-case">Próximamente</Badge>}
                                                    </p>
                                                    {area.description && (
                                                        <p className="truncate text-xs text-muted-foreground">{area.description}</p>
                                                    )}
                                                </div>
                                                {!disabled && <IconChevronRight size={16} className="shrink-0 text-muted-foreground" />}
                                            </button>
                                        );
                                    })}
                                </Card>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Card className="p-6">
                        <div className="flex flex-col gap-6">
                            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                                <Field label="1. Área de Negocio">
                                    <Combobox
                                        placeholder="Seleccione área"
                                        options={areas.map(a => ({ value: a, label: a }))}
                                        value={selectedArea}
                                        onValueChange={(val) => {
                                            setSelectedArea(val);
                                            const firstInArea = TABLES_TO_EXPORT.find(t => t.area === val);
                                            if (firstInArea) setSelectedId(firstInArea.id);
                                        }}
                                    />
                                </Field>
                                <Field label="2. Recurso / Tabla">
                                    <Combobox
                                        placeholder="Seleccione recurso"
                                        options={TABLES_TO_EXPORT.filter(t => t.area === selectedArea).map(t => ({
                                            value: t.id,
                                            label: t.label
                                        }))}
                                        value={selectedId}
                                        onValueChange={(val) => setSelectedId(val)}
                                    />
                                </Field>
                            </div>

                            <Card className="bg-muted/40 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                            <IconFileSpreadsheet size={24} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">Recurso: {activeExport?.label}</p>
                                            <p className="text-xs text-muted-foreground">Se generará un archivo Excel (.xlsx) con los datos del servidor.</p>
                                        </div>
                                    </div>
                                    <Button onClick={handleExport} disabled={exporting}>
                                        {exporting ? (
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                        ) : (
                                            <IconDownload size={16} />
                                        )}
                                        Generar Reporte
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="mb-1 text-xs text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}
