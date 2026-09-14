import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { fichaService } from '../services/ficha.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Card, Input, Select, Button, Table, Tag, Tooltip, Typography, DatePicker, Spin } from 'antd';
import {
    IconSearch,
    IconEraser,
    IconFilter,
    IconExternalLink,
} from '@tabler/icons-react';

import { useNavStore } from '../../../store/navStore';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';

const { Text } = Typography;

// El backend (mssql) devuelve los datetime guardados con GETDATE() (hora local del servidor)
// como si fueran UTC. Usamos los componentes UTC para evitar que el navegador
// reste el offset horario nuevamente.
const formatFechaHoraServidor = (value: string | Date) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

interface Props {
    onBackToMenu: () => void;
}

interface GroupedMuestreo {
    fecha: string;
    etiqueta: string;
    items: any[];
}

export const MuestreosEjecutadosListView: React.FC<Props> = ({ onBackToMenu }) => {
    const { setSelectedFicha, setActiveSubmodule, activeModule } = useNavStore();
    const { showToast } = useToast();
    const [muestreos, setMuestreos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [realizadoStates, setRealizadoStates] = useState<Record<string, { realizado: boolean, userName: string, fecha: string }>>({});

    // Local cache: idAgendamam → caso_adlab asignado en esta sesión
    const [casoAdlabMap, setCasoAdlabMap] = useState<Record<string, string>>({});

    // Filters
    const [searchCorrelativo, setSearchCorrelativo] = useState('');
    const [searchCliente, setSearchCliente] = useState<string | null>(null);
    const [searchMuestreador, setSearchMuestreador] = useState<string | null>(null);
    const [searchObjetivo, setSearchObjetivo] = useState<string | null>(null);
    const [fechaDesde, setFechaDesde] = useState<Date | null>(null);
    const [fechaHasta, setFechaHasta] = useState<Date | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    useEffect(() => {
        loadMuestreos();
    }, []);

    const loadMuestreos = async () => {
        setLoading(true);
        try {
            const response = await fichaService.getMuestreosEjecutados();
            let data = [];
            if (Array.isArray(response)) data = response;
            else if (response && response.data && Array.isArray(response.data)) data = response.data;
            else if (response && Array.isArray(response.recordset)) data = response.recordset;

            setMuestreos(data || []);

            // Initialize realizadoStates from DB data
            const initialStates: Record<string, { realizado: boolean, userName: string, fecha: string }> = {};
            const initialCasos: Record<string, string> = {};
            (data || []).forEach((m: any) => {
                const key = m.id_agendamam?.toString();
                if (key && m.realizado_por_gem) {
                    initialStates[key] = {
                        realizado: true,
                        userName: m.realizado_por_gem,
                        fecha: m.fecha_realizado_gem ? formatFechaHoraServidor(m.fecha_realizado_gem) : ''
                    };
                }
                if (key && m.caso_adlab) {
                    initialCasos[key] = m.caso_adlab;
                }
            });
            setRealizadoStates(initialStates);
            setCasoAdlabMap(initialCasos);
        } catch (error) {
            console.error("Error loading muestreos ejecutados:", error);
            showToast({ type: 'error', message: "Error al cargar los muestreos ejecutados" });
        } finally {
            setLoading(false);
        }
    };

    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        muestreos.forEach(m => {
            if (m[key]) values.add(String(m[key]).trim());
        });
        return Array.from(values).sort().map(v => ({ value: v, label: v }));
    };

    const uniqueClientes = useMemo(() => getUniqueValues('cliente'), [muestreos]);
    const uniqueMuestreadores = useMemo(() => getUniqueValues('muestreador'), [muestreos]);
    const uniqueObjetivos = useMemo(() => getUniqueValues('objetivo'), [muestreos]);

    const handleClearFilters = () => {
        setSearchCorrelativo('');
        setSearchCliente(null);
        setSearchMuestreador(null);
        setSearchObjetivo(null);
        setFechaDesde(null);
        setFechaHasta(null);
        setCurrentPage(1);
    };

    const getDayLabel = (date: Date) => {
        const label = date.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        // Capitalizar primera letra para que se vea mejor
        return label.charAt(0).toUpperCase() + label.slice(1);
    };

    const filteredMuestreos = useMemo(() => {
        return muestreos.filter(m => {
            const check = (val: string, search: string | null) => {
                if (!search) return true;
                return (val || '').toString().toLowerCase().includes(search.toLowerCase());
            };
            const matchCorr = check(m.frecuencia_correlativo, searchCorrelativo) || check(m.caso_adlab, searchCorrelativo);
            const matchCliente = check(m.cliente, searchCliente);
            const matchMues = check(m.muestreador, searchMuestreador);
            const matchObj = check(m.objetivo, searchObjetivo);

            // Filtro de fecha
            let matchFecha = false;
            if (m.fecha_retiro) {
                matchFecha = true;
                const fecha = new Date(m.fecha_retiro);
                if (fechaDesde) {
                    const desde = new Date(fechaDesde);
                    desde.setHours(0, 0, 0, 0);
                    matchFecha = matchFecha && fecha >= desde;
                }
                if (fechaHasta) {
                    const hasta = new Date(fechaHasta);
                    hasta.setHours(23, 59, 59, 999);
                    matchFecha = matchFecha && fecha <= hasta;
                }
            }

            return matchCorr && matchCliente && matchMues && matchObj && matchFecha;
        });
    }, [muestreos, searchCorrelativo, searchCliente, searchMuestreador, searchObjetivo, fechaDesde, fechaHasta]);

    const sortedMuestreos = useMemo(() => {
        return [...filteredMuestreos].sort((a, b) => {
            const dateA = a.fecha_retiro ? new Date(a.fecha_retiro).getTime() : 0;
            const dateB = b.fecha_retiro ? new Date(b.fecha_retiro).getTime() : 0;
            return dateB - dateA; // Más recientes primero
        });
    }, [filteredMuestreos]);

    const groupedMuestreos = useMemo(() => {
        const groups: Record<string, GroupedMuestreo> = {};

        sortedMuestreos.forEach(m => {
            if (!m.fecha_retiro) return;
            const fecha = new Date(m.fecha_retiro);
            fecha.setHours(0, 0, 0, 0);
            const fechaStr = fecha.toISOString().split('T')[0];

            if (!groups[fechaStr]) {
                groups[fechaStr] = {
                    fecha: fechaStr,
                    etiqueta: getDayLabel(fecha),
                    items: []
                };
            }
            groups[fechaStr].items.push(m);
        });

        return Object.values(groups).sort((a, b) => {
            return new Date(b.fecha).getTime() - new Date(a.fecha).getTime(); // Más recientes primero
        });
    }, [sortedMuestreos]);

    const totalItems = sortedMuestreos.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    // Paginate grouped data
    let itemCount = 0;
    const pageStart = (currentPage - 1) * itemsPerPage;
    const pageEnd = currentPage * itemsPerPage;
    const displayedGroups: GroupedMuestreo[] = [];

    for (const group of groupedMuestreos) {
        const groupStart = itemCount;
        const groupEnd = itemCount + group.items.length;

        if (groupEnd > pageStart && groupStart < pageEnd) {
            displayedGroups.push({
                ...group,
                items: group.items.slice(
                    Math.max(0, pageStart - groupStart),
                    Math.max(0, pageEnd - groupStart)
                )
            });
        }
        itemCount += group.items.length;
        if (itemCount >= pageEnd) break;
    }

    const showCaso = activeModule !== 'gem' && activeModule !== 'unidades-gem';

    const columns = [
        ...(showCaso ? [{
            title: 'Caso ADLab', width: 90,
            render: (_: any, m: any) => {
                const key = m.id_agendamam?.toString();
                return casoAdlabMap[key] ? <Tag color="blue">{casoAdlabMap[key]}</Tag> : <Text type="secondary" style={{ fontSize: 12 }}>Sin asignar</Text>;
            },
        }] : []),
        {
            title: 'Correlativo', width: 130,
            render: (_: any, m: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                    <Text style={{ fontSize: 12, fontWeight: 600 }} title={m.frecuencia_correlativo}>{m.frecuencia_correlativo || '-'}</Text>
                    {m.fecha_completado && dayjs().diff(dayjs(m.fecha_completado), 'hour') < 24 && <Tag color="green">Nuevo</Tag>}
                </div>
            ),
        },
        {
            title: 'Fecha', width: 110,
            render: (_: any, m: any) => <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{m.fecha_retiro ? new Date(m.fecha_retiro).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '-'}</Text>,
        },
        { title: 'Cliente', dataIndex: 'cliente', width: 180, ellipsis: { showTitle: true } },
        { title: 'F. Emisora', dataIndex: 'centro', width: 180, ellipsis: { showTitle: true } },
        {
            title: 'Área / Obj.', width: 160,
            render: (_: any, m: any) => (
                <div>
                    <Text style={{ fontSize: 12, fontWeight: 500, display: 'block' }}>{m.nombre_subarea || '-'}</Text>
                    <Text type="secondary" style={{ fontSize: 10 }}>{m.objetivo || '-'}</Text>
                </div>
            ),
        },
        { title: 'M. Inst.', width: 120, render: (_: any, m: any) => <Text style={{ fontSize: 12 }}>{m.muestreador || 'Sin Asignar'}</Text> },
        { title: 'M. Ret.', width: 120, render: (_: any, m: any) => <Text style={{ fontSize: 12 }}>{m.muestreador_retiro || '-'}</Text> },
        {
            title: 'Realizado por GEM', width: 180,
            render: (_: any, m: any) => {
                const key = m.id_agendamam?.toString();
                return realizadoStates[key]?.realizado ? (
                    <div>
                        <Text style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', display: 'block' }}>✓ Realizado</Text>
                        <Text type="secondary" style={{ fontSize: 10, lineHeight: 1.3 }}>
                            <strong>Por:</strong> {realizadoStates[key]?.userName}<br />
                            <strong>Fecha:</strong> {realizadoStates[key]?.fecha}
                        </Text>
                    </div>
                ) : <Text type="secondary" style={{ fontSize: 10 }}>Pendiente</Text>;
            },
        },
        {
            title: 'Acciones', width: 80, align: 'center' as const,
            render: (_: any, m: any) => (
                <ProtectedContent permission={['MA_COMERCIAL_HISTORIAL_DETALLE', 'FI_VER', 'FI_APROBAR_TEC', 'FI_APROBAR_COO']}>
                    <Tooltip title="Ver Detalle Ejecución">
                        <Button
                            type="text"
                            shape="circle"
                            icon={<IconExternalLink size={16} style={{ color: 'var(--app-accent-text)' }} />}
                            onClick={() => {
                                setSelectedFicha(m.id_fichaingresoservicio || m.correlativo_ficha, m.frecuencia_correlativo);
                                setActiveSubmodule('ma-ficha-detalle');
                            }}
                        />
                    </Tooltip>
                </ProtectedContent>
            ),
        },
    ];

    const selectProps = { showSearch: true, allowClear: true, style: { width: '100%' }, placeholder: 'Todos' } as const;

    return (
        <div>
            <PageHeader
                title="Muestreos Completados"
                subtitle="Histórico de servicios ejecutados y reportes generados"
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Muestreos Completados' }
                ]}
                rightSection={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{filteredMuestreos.length} servicios registrados</Text>
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
                    <Field label="Correlativo / ID Caso">
                        <Input placeholder="Ej: 99-1 o ID Caso..." value={searchCorrelativo} onChange={(e) => setSearchCorrelativo(e.target.value)} prefix={<IconSearch size={14} />} />
                    </Field>
                    <Field label="Cliente">
                        <Select options={uniqueClientes} value={searchCliente || undefined} onChange={(v) => setSearchCliente(v || null)} {...selectProps} />
                    </Field>
                    <Field label="Muestreador">
                        <Select options={uniqueMuestreadores} value={searchMuestreador || undefined} onChange={(v) => setSearchMuestreador(v || null)} {...selectProps} />
                    </Field>
                    <Field label="Objetivo">
                        <Select options={uniqueObjetivos} value={searchObjetivo || undefined} onChange={(v) => setSearchObjetivo(v || null)} {...selectProps} />
                    </Field>
                    <Field label="Desde">
                        <DatePicker
                            style={{ width: '100%' }}
                            format="DD/MM/YYYY"
                            value={fechaDesde ? dayjs(fechaDesde) : null}
                            onChange={(d) => setFechaDesde(d ? d.toDate() : null)}
                        />
                    </Field>
                    <Field label="Hasta">
                        <DatePicker
                            style={{ width: '100%' }}
                            format="DD/MM/YYYY"
                            value={fechaHasta ? dayjs(fechaHasta) : null}
                            onChange={(d) => setFechaHasta(d ? d.toDate() : null)}
                        />
                    </Field>
                </div>
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {loading ? (
                    <Card>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 32 }}>
                            <Spin size="large" />
                            <Text type="secondary" style={{ fontSize: 13 }}>Cargando registros históricos...</Text>
                        </div>
                    </Card>
                ) : displayedGroups.length === 0 ? (
                    <Card>
                        <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: 32 }}>No se encontraron muestreos ejecutados.</Text>
                    </Card>
                ) : (
                    displayedGroups.map((group) => (
                        <Card key={group.fecha} styles={{ body: { padding: 0 } }}>
                            <div style={{ padding: 16, backgroundColor: 'var(--app-accent-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text strong style={{ fontSize: 14 }}>{group.etiqueta}</Text>
                                <Tag color="blue">{group.items.length} servicios</Tag>
                            </div>
                            <Table
                                rowKey={(m, idx) => `${m.id_agendamam || m.correlativo_ficha || m.id_fichaingresoservicio}-${idx}`}
                                columns={columns}
                                dataSource={group.items}
                                pagination={false}
                                scroll={{ x: 1100 }}
                                rowClassName={(m) => (realizadoStates[m.id_agendamam?.toString()]?.realizado ? 'muestreo-realizado-row' : '')}
                            />
                        </Card>
                    ))
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                        Mostrando {sortedMuestreos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).length} de {filteredMuestreos.length} registros
                    </Text>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <Button size="small" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>Anterior</Button>
                        <Text style={{ fontSize: 13, padding: '4px 8px' }}>{currentPage} / {totalPages}</Text>
                        <Button size="small" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>Siguiente</Button>
                    </div>
                </div>
            </div>
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
