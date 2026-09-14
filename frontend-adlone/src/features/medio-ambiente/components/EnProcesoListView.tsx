import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { Card, Input, Select, Button, Table, Tag, Tooltip, Typography } from 'antd';
import {
    IconSearch,
    IconEraser,
    IconEdit,
    IconFilter,
    IconClockPlay
} from '@tabler/icons-react';

const { Text } = Typography;

interface Props {
    onBackToMenu: () => void;
    onViewDetail: (id: number) => void;
}

export const EnProcesoListView: React.FC<Props> = ({ onBackToMenu, onViewDetail }) => {
    // State
    const [searchId, setSearchId] = useState('');
    const [dateFrom, setDateFrom] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [dateTo, setDateTo] = useState(() => {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    });
    const { showToast } = useToast();

    const [searchTipo, setSearchTipo] = useState<string | null>(null);
    const [searchEmpresaServicio, setSearchEmpresaServicio] = useState<string | null>(null);
    const [searchMuestreador, setSearchMuestreador] = useState<string | null>(null);
    const [searchObjetivo, setSearchObjetivo] = useState<string | null>(null);
    const [searchSubArea, setSearchSubArea] = useState<string | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);

    const itemsPerPage = 12;

    useEffect(() => {
        loadFichas();
    }, []);

    const loadFichas = async () => {
        setLoading(true);
        try {
            const response = await fichaService.getEnProceso();
            let data = [];
            if (Array.isArray(response)) data = response;
            else if (response && response.data && Array.isArray(response.data)) data = response.data;
            else if (response && Array.isArray(response.recordset)) data = response.recordset;

            setFichas(data || []);
        } catch (error) {
            console.error("Error loading en proceso fichas:", error);
            showToast({ type: 'error', message: 'Error cargando las fichas en proceso.' });
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

    const uniqueTipos = useMemo(() => getUniqueValues('tipo_ficha'), [fichas]);
    const uniqueEmpServicio = useMemo(() => getUniqueValues('empresa_servicio'), [fichas]);
    const uniqueMuestreadores = useMemo(() => getUniqueValues('muestreador'), [fichas]);
    const uniqueObjetivos = useMemo(() => getUniqueValues('objetivo'), [fichas]);
    const uniqueSubAreas = useMemo(() => getUniqueValues('subarea'), [fichas]);

    const handleClearFilters = () => {
        setSearchId('');
        setDateFrom('');
        setDateTo('');
        setSearchTipo(null);
        setSearchEmpresaServicio(null);
        setSearchMuestreador(null);
        setSearchObjetivo(null);
        setSearchSubArea(null);
        setCurrentPage(1);
    };

    const filteredFichas = useMemo(() => {
        return fichas.filter(f => {
            const displayId = f.correlativo || f.id || f.fichaingresoservicio || '';
            const matchId = searchId ? String(displayId).includes(searchId) : true;

            const check = (val: string, search: string | null) => {
                if (!search) return true;
                return (val || '').toString().toLowerCase().includes(search.toLowerCase());
            };

            const matchTipo = check(f.tipo_ficha, searchTipo);
            const matchEmpresaServicio = check(f.empresa_servicio, searchEmpresaServicio);
            const matchMuestreador = check(f.muestreador, searchMuestreador);
            const matchObjetivo = check(f.objetivo, searchObjetivo);
            const matchSubArea = check(f.subarea, searchSubArea);

            let matchDate = true;
            if (dateFrom || dateTo) {
                if (!f.fecha) return false;
                let rowDate: Date;
                if (typeof f.fecha === 'string' && f.fecha.includes('/')) {
                    const parts = f.fecha.split('/');
                    rowDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                } else {
                    rowDate = new Date(f.fecha);
                }
                rowDate.setHours(0, 0, 0, 0);

                if (dateFrom && rowDate < new Date(dateFrom)) matchDate = false;
                if (dateTo && rowDate > new Date(dateTo)) matchDate = false;
            }

            return matchId && matchDate && matchTipo && matchEmpresaServicio && matchMuestreador && matchObjetivo && matchSubArea;
        });
    }, [fichas, searchId, dateFrom, dateTo, searchTipo, searchEmpresaServicio, searchMuestreador, searchObjetivo, searchSubArea]);

    const sortedFichas = useMemo(() => {
        return [...filteredFichas].sort((a, b) => {
            const dateA = a.fecha ? new Date(a.fecha).getTime() : 0;
            const dateB = b.fecha ? new Date(b.fecha).getTime() : 0;
            return dateB - dateA;
        });
    }, [filteredFichas]);

    // Columnas consolidadas: 6 en vez de 9 — Empresa+Contacto y
    // Objetivo+Sub Área comparten celda apilada, como en las otras bandejas
    // ya migradas.
    const columns = [
        {
            title: 'N° Ficha', width: 90,
            render: (_: any, f: any) => <Text strong style={{ color: '#0d9488' }}>{f.correlativo || f.id || '-'}</Text>,
        },
        {
            title: 'Fecha M.', width: 110,
            render: (_: any, f: any) => <Text style={{ fontSize: 12.5, fontWeight: 500 }}>{f.fecha ? new Date(f.fecha).toLocaleDateString('es-ES') : 'Sin Fecha'}</Text>,
        },
        {
            title: 'Muestreador', width: 160,
            render: (_: any, f: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconClockPlay size={14} color="var(--app-accent-text)" />
                    <Text style={{ fontSize: 12.5, fontWeight: 500 }}>{f.muestreador || 'Por Asignar'}</Text>
                </div>
            ),
        },
        {
            title: 'Tipo', width: 120,
            render: (_: any, f: any) => <Tag color="blue">{f.tipo_ficha || '-'}</Tag>,
        },
        {
            title: 'Empresa / Contacto', width: 220,
            render: (_: any, f: any) => (
                <div>
                    <Text style={{ fontSize: 12.5, fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.empresa_servicio}>
                        {f.empresa_servicio || '-'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={f.contacto}>
                        {f.contacto || f.correo_empresa || '-'}
                    </Text>
                </div>
            ),
        },
        {
            title: 'Objetivo / Sub Área', width: 220,
            render: (_: any, f: any) => (
                <div>
                    <Text style={{ fontSize: 12.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.objetivo}>
                        {f.objetivo || '-'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{f.subarea || '-'}</Text>
                </div>
            ),
        },
        {
            title: '', width: 60, align: 'center' as const,
            render: (_: any, f: any) => (
                <ProtectedContent permission="FI_VER">
                    <Tooltip title="Gestionar Ficha">
                        <Button type="primary" style={{ backgroundColor: '#0d9488' }} shape="circle" size="small" icon={<IconEdit size={16} />} onClick={() => onViewDetail(f.id)} />
                    </Tooltip>
                </ProtectedContent>
            ),
        },
    ];

    const selectProps = { showSearch: true, allowClear: true, style: { width: '100%' }, placeholder: 'Todos' } as const;

    return (
        <div>
            <PageHeader
                title="Fichas en Proceso"
                subtitle="Seguimiento de servicios programados y en ejecución"
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'En Proceso' }
                ]}
                rightSection={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{filteredFichas.length} registros</Text>
                        <Button icon={<IconEraser size={14} />} onClick={handleClearFilters}>Limpiar Filtros</Button>
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
                    <Field label="Desde">
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </Field>
                    <Field label="Hasta">
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </Field>
                    <Field label="Tipo Ficha">
                        <Select options={uniqueTipos} value={searchTipo || undefined} onChange={(v) => setSearchTipo(v || null)} {...selectProps} />
                    </Field>
                    <Field label="Empresa Servicio">
                        <Select options={uniqueEmpServicio} value={searchEmpresaServicio || undefined} onChange={(v) => setSearchEmpresaServicio(v || null)} {...selectProps} />
                    </Field>
                    <Field label="Muestreador">
                        <Select options={uniqueMuestreadores} value={searchMuestreador || undefined} onChange={(v) => setSearchMuestreador(v || null)} {...selectProps} />
                    </Field>
                    <Field label="Objetivo">
                        <Select options={uniqueObjetivos} value={searchObjetivo || undefined} onChange={(v) => setSearchObjetivo(v || null)} {...selectProps} />
                    </Field>
                    <Field label="Sub Área">
                        <Select options={uniqueSubAreas} value={searchSubArea || undefined} onChange={(v) => setSearchSubArea(v || null)} {...selectProps} />
                    </Field>
                </div>
            </Card>

            <Card styles={{ body: { padding: 0 } }}>
                <Table
                    rowKey={(f) => `${f.id}-${f.correlativo}`}
                    columns={columns}
                    dataSource={sortedFichas}
                    loading={loading}
                    scroll={{ x: 900 }}
                    pagination={{
                        current: currentPage,
                        pageSize: itemsPerPage,
                        total: sortedFichas.length,
                        onChange: setCurrentPage,
                        style: { paddingInline: 16 },
                    }}
                    locale={{ emptyText: 'No se encontraron fichas en proceso.' }}
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
