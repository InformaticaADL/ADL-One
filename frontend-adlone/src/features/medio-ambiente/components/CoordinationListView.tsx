import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Card, Input, Button, Table, Tag, Tooltip, Typography } from 'antd';
import {
    IconSearch,
    IconEraser,
    IconFileDownload,
    IconEye,
    IconFilter
} from '@tabler/icons-react';
import { useToast } from '../../../contexts/ToastContext';

const { Text } = Typography;

interface Props {
    onBackToMenu: () => void;
    onViewDetail: (id: number) => void;
}

export const CoordinationListView: React.FC<Props> = ({ onBackToMenu, onViewDetail }) => {
    const { showToast } = useToast();
    // State
    const [searchId, setSearchId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);

    const itemsPerPage = 15;

    useEffect(() => {
        loadFichas();
    }, []);

    const loadFichas = async () => {
        setLoading(true);
        try {
            const response = await fichaService.getAll();
            let data = [];
            if (Array.isArray(response)) data = response;
            else if (response && response.data && Array.isArray(response.data)) data = response.data;
            else if (response && Array.isArray(response.recordset)) data = response.recordset;

            setFichas(data || []);
        } catch (error) {
            console.error("Error loading coordination fichas:", error);
            showToast({ type: 'error', message: 'Error al cargar fichas de coordinación' });
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        setSearchId('');
        setDateFrom('');
        setDateTo('');
        setCurrentPage(1);
    };

    const handleDownloadPdf = async (id: number) => {
        try {
            const blob = await fichaService.downloadPdf(id);
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Ficha_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error downloading PDF:", error);
            showToast({ type: 'error', message: 'Error al descargar el PDF de la ficha' });
        }
    };

    const filteredFichas = useMemo(() => {
        return fichas.filter(f => {
            const displayId = f.fichaingresoservicio || f.id_fichaingresoservicio || '';
            const matchId = searchId ? String(displayId).includes(searchId) : true;

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

            return matchId && matchDate;
        });
    }, [fichas, searchId, dateFrom, dateTo]);

    const sortedFichas = useMemo(() => {
        return [...filteredFichas].sort((a, b) => {
            return (b.id_fichaingresoservicio || 0) - (a.id_fichaingresoservicio || 0);
        });
    }, [filteredFichas]);

    const getStatusColor = (status: string) => {
        const s = (status || '').toUpperCase();
        if (s.includes('EMITIDA') || s.includes('VIGENTE') || s.includes('APROBADA')) return 'green';
        if (s.includes('RECHAZADA') || s.includes('ANULADA')) return 'red';
        if (s.includes('PENDIENTE')) return 'gold';
        return 'default';
    };

    // Columnas consolidadas: 5 en vez de 9 — el detalle secundario (fuente
    // emisora, objetivo, sub área) va apilado en una sola celda en vez de
    // ocupar 3 columnas propias. Menos ancho, misma información.
    const columns = [
        {
            title: 'N° Ficha', width: 90,
            render: (_: any, f: any) => <Text strong style={{ color: 'var(--app-accent-text)' }}>{f.fichaingresoservicio || '-'}</Text>,
        },
        {
            title: 'Estado', width: 140,
            render: (_: any, f: any) => <Tag color={getStatusColor(f.estado_ficha)}>{f.estado_ficha || '-'}</Tag>,
        },
        { title: 'Fecha', dataIndex: 'fecha', width: 100 },
        { title: 'Tipo', dataIndex: 'tipo_fichaingresoservicio', width: 110 },
        {
            title: 'Empresa', width: 220,
            render: (_: any, f: any) => (
                <div>
                    <Text style={{ fontSize: 12.5, fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.empresa_facturar}>
                        {f.empresa_facturar || '-'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={f.empresa_servicio}>
                        {f.empresa_servicio || '-'}
                    </Text>
                </div>
            ),
        },
        {
            title: 'Servicio', width: 260,
            render: (_: any, f: any) => (
                <div>
                    <Text style={{ fontSize: 12.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.centro}>
                        {f.centro || '-'}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={`${f.nombre_objetivomuestreo_ma || ''} · ${f.nombre_subarea || ''}`}>
                        {f.nombre_objetivomuestreo_ma || '-'}{f.nombre_subarea ? ` · ${f.nombre_subarea}` : ''}
                    </Text>
                </div>
            ),
        },
        {
            title: '', width: 90, align: 'center' as const,
            render: (_: any, f: any) => {
                const id = f.id_fichaingresoservicio || f.fichaingresoservicio;
                return (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                        <Tooltip title="Descargar PDF">
                            <Button type="text" danger shape="circle" size="small" icon={<IconFileDownload size={16} />} onClick={() => handleDownloadPdf(id)} />
                        </Tooltip>
                        <Tooltip title="Ver Detalle">
                            <Button type="primary" shape="circle" size="small" icon={<IconEye size={16} />} onClick={() => onViewDetail(id)} />
                        </Tooltip>
                    </div>
                );
            },
        },
    ];

    return (
        <div>
            <PageHeader
                title="Bandeja de Coordinación"
                subtitle="Consulta y seguimiento general de fichas de servicio"
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Coordinación' }
                ]}
                rightSection={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{filteredFichas.length} fichas encontradas</Text>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                    <Field label="N° Ficha">
                        <Input placeholder="Ej: 105" value={searchId} onChange={(e) => setSearchId(e.target.value)} prefix={<IconSearch size={14} />} />
                    </Field>
                    <Field label="Fecha Desde">
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </Field>
                    <Field label="Fecha Hasta">
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </Field>
                </div>
            </Card>

            <Card styles={{ body: { padding: 0 } }}>
                <Table
                    rowKey={(f) => `${f.id_fichaingresoservicio || f.fichaingresoservicio}`}
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
                    locale={{ emptyText: 'No se encontraron fichas en la bandeja.' }}
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
