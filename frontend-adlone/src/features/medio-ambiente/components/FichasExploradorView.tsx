import React, { useState, useEffect } from 'react';
import { fichaService } from '../services/ficha.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { FichaExportModal } from './FichaExportModal';

import { Button, Typography, Card, Input, Select, Table, Tag, Tooltip } from 'antd';
import {
    IconAdjustmentsHorizontal,
    IconDownload,
    IconTrash,
    IconEye,
} from '@tabler/icons-react';

const { Text } = Typography;

interface Props {
    onBackToMenu: () => void;
    onViewDetail: (id: number) => void;
}

export const FichasExploradorView: React.FC<Props> = ({ onBackToMenu, onViewDetail }) => {
    const [searchId, setSearchId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchEstado, setSearchEstado] = useState('');
    const [searchTipo, setSearchTipo] = useState('');
    const [searchEmpresaFacturar, setSearchEmpresaFacturar] = useState('');
    const [searchEmpresaServicio, setSearchEmpresaServicio] = useState('');
    const [searchCentro, setSearchCentro] = useState('');
    const [searchObjetivo, setSearchObjetivo] = useState('');
    const [searchSubArea, setSearchSubArea] = useState('');
    const [searchUsuario, setSearchUsuario] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);
    const [showExportModal, setShowExportModal] = useState(false);

    const itemsPerPage = 10;

    useEffect(() => {
        const loadFichas = async () => {
            setLoading(true);
            try {
                const response = await fichaService.getAll();
                let data: any[] = [];
                if (Array.isArray(response)) data = response;
                else if (response && response.data && Array.isArray(response.data)) data = response.data;
                else if (response && Array.isArray(response.recordset)) data = response.recordset;

                // Ordenar por ID de mayor a menor
                data.sort((a, b) => {
                    const idA = a.id_fichaingresoservicio || a.fichaingresoservicio || 0;
                    const idB = b.id_fichaingresoservicio || b.fichaingresoservicio || 0;
                    return idB - idA;
                });

                setFichas(data || []);
            } catch (error) {
                console.error("Error loading fichas:", error);
            } finally {
                setLoading(false);
            }
        };
        loadFichas();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchId, dateFrom, dateTo, searchEstado, searchTipo, searchEmpresaFacturar, searchEmpresaServicio, searchCentro, searchObjetivo, searchSubArea, searchUsuario]);

    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort().map(val => ({ value: val, label: val }));
    };

    const uniqueEstados = React.useMemo(() => getUniqueValues('estado_ficha'), [fichas]);
    const uniqueTipos = React.useMemo(() => getUniqueValues('tipo_fichaingresoservicio'), [fichas]);
    const uniqueEmpFacturar = React.useMemo(() => getUniqueValues('empresa_facturar'), [fichas]);
    const uniqueEmpServicio = React.useMemo(() => getUniqueValues('empresa_servicio'), [fichas]);
    const uniqueCentros = React.useMemo(() => getUniqueValues('centro'), [fichas]);
    const uniqueObjetivos = React.useMemo(() => getUniqueValues('nombre_objetivomuestreo_ma'), [fichas]);
    const uniqueSubAreas = React.useMemo(() => getUniqueValues('nombre_subarea'), [fichas]);
    const uniqueUsuarios = React.useMemo(() => getUniqueValues('nombre_usuario'), [fichas]);

    // For FichaExportModal format
    const getPlainValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort();
    };

    const handleClearFilters = () => {
        setSearchId('');
        setDateFrom('');
        setDateTo('');
        setSearchEstado('');
        setSearchTipo('');
        setSearchEmpresaFacturar('');
        setSearchEmpresaServicio('');
        setSearchCentro('');
        setSearchObjetivo('');
        setSearchSubArea('');
        setSearchUsuario('');
    };

    const filteredFichas = fichas.filter(f => {
        const displayId = f.fichaingresoservicio || f.id_fichaingresoservicio || '';
        const matchId = searchId ? String(displayId).includes(searchId) : true;
        const check = (val: string, search: string) => (!search || (val || '').toString().toLowerCase().includes(search.toLowerCase()));

        const matchEstado = check(f.estado_ficha, searchEstado);
        const matchTipo = check(f.tipo_fichaingresoservicio, searchTipo);
        const matchEmpresaFacturar = check(f.empresa_facturar, searchEmpresaFacturar);
        const matchEmpresaServicio = check(f.empresa_servicio, searchEmpresaServicio);
        const matchCentro = check(f.centro, searchCentro);
        const matchObjetivo = check(f.nombre_objetivomuestreo_ma, searchObjetivo);
        const matchSubArea = check(f.nombre_subarea, searchSubArea);
        const matchUsuario = check(f.nombre_usuario, searchUsuario);

        let matchDate = true;
        if (dateFrom || dateTo) {
            if (!f.fecha) return false;
            const parts = f.fecha.split('/');
            if (parts.length === 3) {
                const [d, m, y] = parts;
                const rowDate = new Date(`${y}-${m}-${d}`);
                rowDate.setHours(0, 0, 0, 0);
                if (dateFrom) {
                    const dFrom = new Date(dateFrom);
                    dFrom.setHours(0, 0, 0, 0);
                    if (rowDate < dFrom) matchDate = false;
                }
                if (dateTo && matchDate) {
                    const dTo = new Date(dateTo);
                    dTo.setHours(0, 0, 0, 0);
                    if (rowDate > dTo) matchDate = false;
                }
            }
        }
        return matchId && matchDate && matchEstado && matchTipo && matchEmpresaFacturar && matchEmpresaServicio && matchCentro && matchObjetivo && matchSubArea && matchUsuario;
    });

    const getStatusProps = (status: string) => {
        const s = (status || '').toUpperCase();
        if (s.includes('RECHAZADA') || s.includes('CANCELADO') || s.includes('REVISAR')) return { color: 'red', label: s };
        if (s.includes('COORDINACIÓN')) return { color: 'blue', label: s };
        if (s.includes('PROGRAMACIÓN')) return { color: 'purple', label: s };
        if (s.includes('PENDIENTE') || s.includes('ÁREA TÉCNICA')) return { color: 'gold', label: 'PENDIENTE TÉCNICA' };
        if (s.includes('ASIGNAR')) return { color: 'orange', label: s };
        if (s.includes('VIGENTE') || s.includes('APROBADA') || s.includes('EJECUTADO') || s.includes('EN PROCESO')) return { color: 'green', label: s };
        return { color: 'default', label: s || 'SIN ESTADO' };
    };

    const columns = [
        {
            title: 'ID', dataIndex: 'fichaingresoservicio', width: 80,
            render: (v: any) => <Text strong style={{ color: 'var(--app-accent-text)' }}>{v || '-'}</Text>,
        },
        {
            title: 'Estado', dataIndex: 'estado_ficha', width: 170,
            render: (v: string) => {
                const status = getStatusProps(v);
                return <Tag color={status.color} style={{ width: '100%', textAlign: 'center' }}>{status.label}</Tag>;
            },
        },
        { title: 'Fecha', dataIndex: 'fecha', width: 100 },
        { title: 'Facturar a', dataIndex: 'empresa_facturar', ellipsis: { showTitle: true } },
        { title: 'E. Servicio', dataIndex: 'empresa_servicio', ellipsis: { showTitle: true } },
        { title: 'Objetivo', dataIndex: 'nombre_objetivomuestreo_ma', ellipsis: { showTitle: true } },
        {
            title: 'PDF', width: 60, align: 'center' as const,
            render: (_: any, ficha: any) => (
                <ProtectedContent permission={['FI_EXPORTAR_CFI', 'FI_EXP_AFE']}>
                    <Tooltip title={(ficha.estado_ficha || '').toUpperCase().includes('RECHAZADA') ? 'Atención: esta ficha ha sido rechazada' : 'Descargar PDF'}>
                        <Button
                            type="text"
                            shape="circle"
                            danger={(ficha.estado_ficha || '').toUpperCase().includes('RECHAZADA')}
                            icon={<IconDownload size={18} />}
                            onClick={async (e) => {
                                e.stopPropagation();
                                const idFicha = ficha.id_fichaingresoservicio || ficha.fichaingresoservicio;
                                try {
                                    const pdfBlob = await fichaService.downloadPdf(Number(idFicha));
                                    const url = window.URL.createObjectURL(pdfBlob);
                                    const link = document.createElement('a');
                                    const fileName = ficha.frecuencia_correlativo || `Ficha_${idFicha}`;
                                    link.href = url;
                                    link.setAttribute('download', `${fileName}.pdf`);
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                } catch (err) {
                                    console.error(err);
                                }
                            }}
                        />
                    </Tooltip>
                </ProtectedContent>
            ),
        },
        {
            title: 'Ver', width: 60, align: 'center' as const,
            render: (_: any, ficha: any) => (
                <ProtectedContent permission={['FI_CONSULTAR', 'FI_VER', 'FI_APROBAR_TEC', 'FI_RECHAZAR_TEC', 'FI_APROBAR_COO', 'FI_RECHAZAR_COO', 'FI_EDITAR']}>
                    <Button
                        type="text"
                        shape="circle"
                        icon={<IconEye size={18} style={{ color: 'var(--app-accent-text)' }} />}
                        onClick={() => onViewDetail(ficha.id_fichaingresoservicio || ficha.fichaingresoservicio)}
                    />
                </ProtectedContent>
            ),
        },
    ];

    const selectProps = { showSearch: true, allowClear: true, style: { width: '100%' } } as const;

    return (
        <div>
            <PageHeader
                title="Explorador de Fichas de Ingreso"
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Explorador' }
                ]}
                rightSection={
                    <ProtectedContent permission="FI_EXP_MC">
                        <Button
                            type="primary"
                            style={{ backgroundColor: '#2f9e44' }}
                            icon={<IconDownload size={16} />}
                            onClick={() => setShowExportModal(true)}
                        >
                            Exportar PDF
                        </Button>
                    </ProtectedContent>
                }
            />

            <Card
                title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                            <IconAdjustmentsHorizontal size={18} /> Filtros de búsqueda
                        </span>
                        <Button type="text" size="small" icon={<IconTrash size={14} />} onClick={handleClearFilters}>
                            Limpiar filtros
                        </Button>
                    </div>
                }
                styles={{ header: { border: 'none' } }}
                style={{ marginBottom: 16 }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                    <Field label="N° Ficha">
                        <Input placeholder="Buscar por ID..." value={searchId} onChange={(e) => setSearchId(e.target.value)} />
                    </Field>
                    <Field label="Estado">
                        <Select placeholder="Seleccionar..." options={uniqueEstados} value={searchEstado || undefined} onChange={(v) => setSearchEstado(v || '')} {...selectProps} />
                    </Field>
                    <Field label="Fecha Desde">
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </Field>
                    <Field label="Fecha Hasta">
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </Field>
                    <Field label="Tipo">
                        <Select placeholder="Seleccionar..." options={uniqueTipos} value={searchTipo || undefined} onChange={(v) => setSearchTipo(v || '')} {...selectProps} />
                    </Field>
                    <Field label="Empresa">
                        <Select placeholder="Seleccionar..." options={uniqueEmpFacturar} value={searchEmpresaFacturar || undefined} onChange={(v) => setSearchEmpresaFacturar(v || '')} {...selectProps} />
                    </Field>
                    <Field label="E. Servicio">
                        <Select placeholder="Seleccionar..." options={uniqueEmpServicio} value={searchEmpresaServicio || undefined} onChange={(v) => setSearchEmpresaServicio(v || '')} {...selectProps} />
                    </Field>
                    <Field label="Fuente Emisora">
                        <Select placeholder="Seleccionar..." options={uniqueCentros} value={searchCentro || undefined} onChange={(v) => setSearchCentro(v || '')} {...selectProps} />
                    </Field>
                    <Field label="Objetivo">
                        <Select placeholder="Seleccionar..." options={uniqueObjetivos} value={searchObjetivo || undefined} onChange={(v) => setSearchObjetivo(v || '')} {...selectProps} />
                    </Field>
                    <Field label="Sub Área">
                        <Select placeholder="Seleccionar..." options={uniqueSubAreas} value={searchSubArea || undefined} onChange={(v) => setSearchSubArea(v || '')} {...selectProps} />
                    </Field>
                    <Field label="Usuario">
                        <Select placeholder="Seleccionar..." options={uniqueUsuarios} value={searchUsuario || undefined} onChange={(v) => setSearchUsuario(v || '')} {...selectProps} />
                    </Field>
                </div>
            </Card>

            <FichaExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                initialFilters={{
                    ficha: searchId, estado: searchEstado, fechaDesde: dateFrom, fechaHasta: dateTo, tipo: searchTipo, empresaFacturar: searchEmpresaFacturar, empresaServicio: searchEmpresaServicio, centro: searchCentro, objetivo: searchObjetivo, subArea: searchSubArea, usuario: searchUsuario
                }}
                catalogos={{
                    estados: getPlainValues('estado_ficha'), tipos: getPlainValues('tipo_fichaingresoservicio'), empresasFacturar: getPlainValues('empresa_facturar'), empresasServicio: getPlainValues('empresa_servicio'), centros: getPlainValues('centro'), objetivos: getPlainValues('nombre_objetivomuestreo_ma'), subAreas: getPlainValues('nombre_subarea'), fichas: getPlainValues('id_fichaingresoservicio'), usuarios: getPlainValues('nombre_usuario')
                }}
            />

            <Card styles={{ body: { padding: 0 } }}>
                <Table
                    rowKey={(f) => `${f.id_fichaingresoservicio || f.fichaingresoservicio}`}
                    columns={columns}
                    dataSource={filteredFichas}
                    loading={loading}
                    scroll={{ x: 900 }}
                    pagination={{
                        current: currentPage,
                        pageSize: itemsPerPage,
                        total: filteredFichas.length,
                        onChange: setCurrentPage,
                        showTotal: (total, range) => `Mostrando ${range[0]} a ${range[1]} de ${total} registros`,
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
