import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { Card, Input, Select, Button, Table, Tag, Tooltip, Typography } from 'antd';
import {
    IconSearch,
    IconEraser,
    IconCalendarStats,
    IconFilter
} from '@tabler/icons-react';
import { useToast } from '../../../contexts/ToastContext';

const { Text } = Typography;

interface Props {
    onBackToMenu: () => void;
    onViewAssignment: (id: number) => void;
}

export const AssignmentListView: React.FC<Props> = ({ onBackToMenu, onViewAssignment }) => {
    const { showToast } = useToast();
    // State
    const [searchId, setSearchId] = useState('');
    const [searchEstado, setSearchEstado] = useState<string | null>(null);
    const [searchMonitoreo, setSearchMonitoreo] = useState<string | null>(null);
    const [searchEmpresaFacturar, setSearchEmpresaFacturar] = useState<string | null>(null);
    const [searchEmpresaServicio, setSearchEmpresaServicio] = useState<string | null>(null);
    const [searchCentro, setSearchCentro] = useState<string | null>(null);
    const [searchObjetivo, setSearchObjetivo] = useState<string | null>(null);
    const [searchSubArea, setSearchSubArea] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);
    const [assignmentCounts, setAssignmentCounts] = useState<Record<number, { assigned: number; total: number }>>({});

    const itemsPerPage = 12;

    useEffect(() => {
        loadFichas();
    }, []);

    useEffect(() => {
        const loadAssignmentCounts = async () => {
            const itemsPerPage = 12;
            const counts: Record<number, { assigned: number; total: number }> = {};

            const fichasToLoad = fichas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

            for (const ficha of fichasToLoad) {
                const fichId = ficha.id_fichaingresoservicio || ficha.fichaingresoservicio;
                if (!fichId || assignmentCounts[fichId]) continue;

                try {
                    const data = await fichaService.getAssignmentDetail(fichId);
                    if (Array.isArray(data)) {
                        const total = data.filter(r => !['CANCELADO', 'ANULADO'].includes((r.nombre_estadomuestreo || '').toUpperCase())).length;
                        const assigned = data.filter(r =>
                            !['CANCELADO', 'ANULADO'].includes((r.nombre_estadomuestreo || '').toUpperCase()) &&
                            r.id_muestreador
                        ).length;
                        counts[fichId] = { assigned, total };
                    }
                } catch (error) {
                    console.error(`Error loading counts for ficha ${fichId}:`, error);
                }
            }
            if (Object.keys(counts).length > 0) {
                setAssignmentCounts(prev => ({ ...prev, ...counts }));
            }
        };

        loadAssignmentCounts();
    }, [fichas, currentPage]);

    const loadFichas = async () => {
        setLoading(true);
        try {
            const response = await fichaService.getForAssignment();
            let data = [];
            if (Array.isArray(response)) data = response;
            else if (response && response.data && Array.isArray(response.data)) data = response.data;
            else if (response && Array.isArray(response.recordset)) data = response.recordset;

            setFichas(data || []);
        } catch (error) {
            console.error("Error loading fichas for assignment:", error);
            showToast({ type: 'error', message: 'Error al cargar fichas para asignación' });
        } finally {
            setLoading(false);
        }
    };

    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort().map(v => ({ value: v, label: v }));
    };

    const uniqueEstados = useMemo(() => {
        const v1 = getUniqueValues('estado_ficha');
        return v1.length > 0 ? v1 : getUniqueValues('nombre_estadomuestreo');
    }, [fichas]);

    const uniqueMonitoreo = useMemo(() => {
        const v1 = getUniqueValues('nombre_frecuencia');
        return v1.length > 0 ? v1 : getUniqueValues('frecuencia');
    }, [fichas]);

    const uniqueEmpFacturar = useMemo(() => getUniqueValues('empresa_facturar'), [fichas]);

    const uniqueEmpServicio = useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const val = f.empresa_servicio || f.nombre_empresaservicios;
            if (val) set.add(String(val).trim());
        });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [fichas]);

    const uniqueCentros = useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const val = f.centro || f.nombre_centro;
            if (val) set.add(String(val).trim());
        });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [fichas]);

    const uniqueObjetivos = useMemo(() => getUniqueValues('nombre_objetivomuestreo_ma'), [fichas]);

    const uniqueSubAreas = useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const val = f.subarea || f.nombre_subarea;
            if (val) set.add(String(val).trim());
        });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [fichas]);

    const handleClearFilters = () => {
        setSearchId('');
        setSearchEstado(null);
        setSearchMonitoreo(null);
        setSearchEmpresaFacturar(null);
        setSearchEmpresaServicio(null);
        setSearchCentro(null);
        setSearchObjetivo(null);
        setSearchSubArea(null);
        setDateFrom('');
        setDateTo('');
        setCurrentPage(1);
    };

    const filteredFichas = useMemo(() => {
        return fichas.filter(f => {
            const displayId = f.fichaingresoservicio || f.id_fichaingresoservicio || '';
            const matchId = searchId ? String(displayId).includes(searchId) : true;

            const check = (val: string, search: string | null) => {
                if (!search) return true;
                return (val || '').toString().toLowerCase().includes(search.toLowerCase());
            };

            const matchEstado = check(f.estado_ficha || f.nombre_estadomuestreo, searchEstado);
            const matchMonitoreo = check(f.nombre_frecuencia || f.frecuencia, searchMonitoreo);
            const matchEmpFacturar = check(f.empresa_facturar, searchEmpresaFacturar);
            const matchEmpServicio = check(f.empresa_servicio || f.nombre_empresaservicios, searchEmpresaServicio);
            const matchCentro = check(f.centro || f.nombre_centro, searchCentro);
            const matchObjetivo = check(f.nombre_objetivomuestreo_ma, searchObjetivo);
            const matchSubArea = check(f.subarea || f.nombre_subarea, searchSubArea);

            let matchDate = true;
            if (dateFrom || dateTo) {
                const fDate = f.fecha || f.fecha_muestreo;
                if (!fDate) matchDate = false;
                else {
                    let rowDate: Date;
                    if (typeof fDate === 'string' && fDate.includes('/')) {
                        const parts = fDate.split('/');
                        rowDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    } else {
                        rowDate = new Date(fDate);
                    }
                    rowDate.setHours(0, 0, 0, 0);

                    if (dateFrom && rowDate < new Date(dateFrom)) matchDate = false;
                    if (dateTo && rowDate > new Date(dateTo)) matchDate = false;
                }
            }

            return matchId && matchEstado && matchMonitoreo && matchEmpFacturar && matchEmpServicio && matchCentro && matchObjetivo && matchSubArea && matchDate;
        });
    }, [fichas, searchId, searchEstado, searchMonitoreo, searchEmpresaFacturar, searchEmpresaServicio, searchCentro, searchObjetivo, searchSubArea, dateFrom, dateTo]);

    const sortedFichas = useMemo(() => {
        const getStatusPriority = (status: string) => {
            const s = (status || '').toUpperCase();
            if (s.includes('POR ASIGNAR')) return 1;
            if (s.includes('PENDIENTE')) return 2;
            if (s.includes('EJECUTADO') || s.includes('VIGENTE') || s.includes('EMITIDA')) return 3;
            return 4;
        };

        return [...filteredFichas].sort((a, b) => {
            const statusA = a.estado_ficha || a.nombre_estadomuestreo || '';
            const statusB = b.estado_ficha || b.nombre_estadomuestreo || '';
            const p = getStatusPriority(statusA) - getStatusPriority(statusB);
            if (p !== 0) return p;

            const fichIdA = a.id_fichaingresoservicio || a.fichaingresoservicio;
            const fichIdB = b.id_fichaingresoservicio || b.fichaingresoservicio;
            const countsA = assignmentCounts[fichIdA];
            const countsB = assignmentCounts[fichIdB];

            const pendingA = countsA ? countsA.total - countsA.assigned : 0;
            const pendingB = countsB ? countsB.total - countsB.assigned : 0;

            if (pendingA !== pendingB) return pendingB - pendingA;
            return (b.id_fichaingresoservicio || 0) - (a.id_fichaingresoservicio || 0);
        });
    }, [filteredFichas, assignmentCounts]);

    const getStatusColor = (status: string) => {
        const s = (status || '').toUpperCase();
        if (s.includes('COORDINACIÓN')) return 'red';
        if (s.includes('PROGRAMACIÓN')) return 'orange';
        if (s.includes('EN PROCESO') || s.includes('VIGENTE') || s.includes('APROBADA') || s.includes('EJECUTADO')) return 'green';
        if (s.includes('PENDIENTE') || s.includes('ÁREA TÉCNICA')) return 'gold';
        if (s.includes('RECHAZADA') || s.includes('CANCELADO') || s.includes('ANULADA')) return 'red';
        return 'default';
    };

    const columns = [
        {
            title: 'N° Ficha', width: 80,
            render: (_: any, row: any) => <Text strong style={{ color: 'var(--app-accent-text)' }}>{row.fichaingresoservicio || row.id_fichaingresoservicio}</Text>,
        },
        {
            title: 'Estado', width: 150,
            render: (_: any, row: any) => {
                const status = row.estado_ficha || row.nombre_estadomuestreo;
                return <Tag color={getStatusColor(status)} style={{ whiteSpace: 'normal', textAlign: 'center', width: '100%' }}>{status || '-'}</Tag>;
            },
        },
        {
            title: 'Cliente / E. Servicio', width: 180,
            render: (_: any, row: any) => (
                <div>
                    <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.empresa_facturar}>
                        {row.empresa_facturar || '-'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.empresa_servicio || row.nombre_empresaservicios}>
                        {row.empresa_servicio || row.nombre_empresaservicios || '-'}
                    </Text>
                </div>
            ),
        },
        {
            title: 'F. Emisora', width: 180,
            render: (_: any, row: any) => (
                <div>
                    <Text style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.centro || row.nombre_centro}>
                        {row.centro || row.nombre_centro || '-'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{row.nombre_frecuencia || row.frecuencia || '-'}</Text>
                </div>
            ),
        },
        {
            title: 'Asignación', width: 130, align: 'center' as const,
            render: (_: any, row: any) => {
                const fichId = row.id_fichaingresoservicio || row.fichaingresoservicio;
                const counts = assignmentCounts[fichId];
                if (!counts) return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
                const pending = counts.total - counts.assigned;
                return (
                    <div>
                        <Text style={{ fontSize: 12, fontWeight: 600, color: counts.assigned > 0 ? '#2f9e44' : 'var(--app-text-secondary)' }}>
                            {counts.assigned} asignados
                        </Text>
                        {pending > 0 && <Text style={{ fontSize: 12, color: '#e8590c', display: 'block' }}>{pending} pendientes</Text>}
                    </div>
                );
            },
        },
        {
            title: 'Asignar', width: 70, align: 'center' as const,
            render: (_: any, row: any) => (
                <ProtectedContent permission="FI_GEST_ASIG">
                    {(() => {
                        const status = (row.estado_ficha || row.nombre_estadomuestreo || '').toUpperCase();
                        const isPendingCoordinacion = status.includes('COORDINAC');
                        return isPendingCoordinacion ? (
                            <Tooltip title="Pendiente de aprobación por Área de Coordinación. No es posible gestionar la asignación hasta que sea aprobado.">
                                <Button type="text" shape="circle" disabled icon={<IconCalendarStats size={18} />} />
                            </Tooltip>
                        ) : (
                            <Tooltip title="Gestionar Asignación">
                                <Button
                                    type="primary"
                                    shape="circle"
                                    style={{ backgroundColor: '#9c36b5' }}
                                    icon={<IconCalendarStats size={18} />}
                                    onClick={() => onViewAssignment(row.id_fichaingresoservicio || row.fichaingresoservicio)}
                                />
                            </Tooltip>
                        );
                    })()}
                </ProtectedContent>
            ),
        },
    ];

    const selectProps = { showSearch: true, allowClear: true, style: { width: '100%' }, placeholder: 'Todos' } as const;

    return (
        <div>
            <PageHeader
                title="Planificación y Asignación"
                subtitle="Gestión de recursos y programación de muestreos"
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Asignación' }
                ]}
                rightSection={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{filteredFichas.length} registros encontrados</Text>
                        <Button icon={<IconEraser size={14} />} onClick={handleClearFilters}>
                            Limpiar Filtros
                        </Button>
                    </div>
                }
            />

            <Card
                title={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--app-accent-text)' }}>
                        <IconFilter size={18} /> Filtros de búsqueda
                    </span>
                }
                styles={{ header: { border: 'none' } }}
                style={{ marginBottom: 16 }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                    <Field label="N° Ficha">
                        <Input placeholder="Ej: 1234" value={searchId} onChange={(e) => setSearchId(e.target.value)} prefix={<IconSearch size={14} />} />
                    </Field>
                    <Field label="Estado">
                        <Select options={uniqueEstados} value={searchEstado || undefined} onChange={(v) => setSearchEstado(v || null)} {...selectProps} />
                    </Field>
                    <Field label="Monitoreo">
                        <Select options={uniqueMonitoreo} value={searchMonitoreo || undefined} onChange={(v) => setSearchMonitoreo(v || null)} {...selectProps} />
                    </Field>
                    <Field label="E. Facturar">
                        <Select options={uniqueEmpFacturar} value={searchEmpresaFacturar || undefined} onChange={(v) => setSearchEmpresaFacturar(v || null)} {...selectProps} />
                    </Field>
                    <Field label="E. Servicio">
                        <Select options={uniqueEmpServicio} value={searchEmpresaServicio || undefined} onChange={(v) => setSearchEmpresaServicio(v || null)} {...selectProps} />
                    </Field>
                    <Field label="Fuente Emisora">
                        <Select options={uniqueCentros} value={searchCentro || undefined} onChange={(v) => setSearchCentro(v || null)} {...selectProps} />
                    </Field>
                    <Field label="Obj. Muestreo">
                        <Select options={uniqueObjetivos} value={searchObjetivo || undefined} onChange={(v) => setSearchObjetivo(v || null)} {...selectProps} />
                    </Field>
                    <Field label="Sub Área">
                        <Select options={uniqueSubAreas} value={searchSubArea || undefined} onChange={(v) => setSearchSubArea(v || null)} {...selectProps} />
                    </Field>
                    <Field label="Desde">
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </Field>
                    <Field label="Hasta">
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </Field>
                </div>
            </Card>

            <Card styles={{ body: { padding: 0 } }}>
                <Table
                    rowKey={(row) => `${row.id_fichaingresoservicio || row.fichaingresoservicio}`}
                    columns={columns}
                    dataSource={sortedFichas}
                    loading={loading}
                    scroll={{ x: 900 }}
                    pagination={{
                        current: currentPage,
                        pageSize: itemsPerPage,
                        total: sortedFichas.length,
                        onChange: setCurrentPage,
                        showTotal: (total) => `Resultados (${total})`,
                        style: { paddingInline: 16 },
                    }}
                />
            </Card>
        </div>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
        </div>
    );
}
