import React, { useState } from 'react';
import {
    IconDownload,
    IconSettings,
    IconFileSpreadsheet,
    IconChevronRight
} from '@tabler/icons-react';
import { useAuth } from '../../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { adminExportService } from '../services/admin.service';
import { EquipoCatalogoView } from '../components/EquipoCatalogoView';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';

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
        // RB-08: AI_MA_ADMIN_ACCESO eliminado
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

            <div className="mt-8 flex flex-col gap-6">
                {currentView === 'grid' ? (
                    <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                        {visibleAreas.map((area) => (
                            <Card
                                key={area.id}
                                onClick={() => onNavigate(area.id)}
                                className="flex h-full min-h-[180px] cursor-pointer flex-col items-center justify-center p-6 text-center transition-all hover:-translate-y-1 hover:border-primary hover:bg-accent"
                            >
                                <div className="mb-4 text-4xl">{area.icon}</div>
                                <p className="text-base font-semibold text-foreground">{area.label}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{area.description}</p>
                                <div className="mt-4 flex items-center justify-center gap-1 text-primary">
                                    <span className="text-xs font-semibold">Acceder</span>
                                    <IconChevronRight size={12} />
                                </div>
                            </Card>
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
