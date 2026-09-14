import React from 'react';
import {
    Table,
    Tag,
    Button,
    Tooltip,
    Typography,
    Checkbox,
    Popover,
    Alert,
    Modal,
    Divider,
    Tabs,
    Card,
    Spin,
    Badge
} from 'antd';
import {
    IconCheck,
    IconAlertTriangle,
    IconX,
    IconInfoCircle,
    IconFlask,
    IconEye,
    IconClipboardList,
    IconCodeDots,
    IconMapPin
} from '@tabler/icons-react';
import apiClient from '../../../config/axios.config';

const { Text } = Typography;

interface Props {
    items: any[];
    selectedIndices: number[];
    onSelectChange: (indices: number[]) => void;
}

type LinkStatus = { status: 'loading' | 'ok' | 'warn' | 'invalid' | 'empty'; lat?: number; lon?: number };

export const BulkReviewGrid: React.FC<Props> = ({ items, selectedIndices, onSelectChange }) => {
    const [previewItem, setPreviewItem] = React.useState<any>(null);
    const [previewIndex, setPreviewIndex] = React.useState<number>(-1);
    const [linkStatuses, setLinkStatuses] = React.useState<Record<number, LinkStatus>>({});

    // "-" o vacío se consideran SIN enlace (no se validan en Google Maps)
    const cleanLink = (l?: string): string => {
        const t = (l || '').trim();
        return (t === '' || t === '-') ? '' : t;
    };

    // Auto-verify all Google Maps links when items load
    React.useEffect(() => {
        if (!items || items.length === 0) { setLinkStatuses({}); return; }

        const initialStatuses: Record<number, LinkStatus> = {};
        items.forEach((item, idx) => {
            const link = cleanLink(item.antecedentes?.refGoogle);
            initialStatuses[idx] = link ? { status: 'loading' } : { status: 'empty' };
        });
        setLinkStatuses(initialStatuses);

        items.forEach((item, idx) => {
            const link = cleanLink(item.antecedentes?.refGoogle);
            if (!link) return;
            apiClient.post('/api/fichas/verificar-link', { link })
                .then(({ data }) => {
                    const d = data?.data;
                    setLinkStatuses(prev => ({
                        ...prev,
                        [idx]: d?.ok ? { status: 'ok', lat: d.lat, lon: d.lon } : { status: 'warn' }
                    }));
                })
                .catch(() => {
                    setLinkStatuses(prev => ({ ...prev, [idx]: { status: 'warn' } }));
                });
        });
    }, [items]);

    const toggleAll = () => {
        if (selectedIndices.length === items.filter(i => i.status === 'READY' || i.status === 'WARNING').length) {
            onSelectChange([]);
        } else {
            onSelectChange(items.map((item, index) => (item.status === 'READY' || item.status === 'WARNING' ? index : -1)).filter(i => i !== -1));
        }
    };

    const toggleItem = (index: number) => {
        const item = items[index];
        if (!item || (item.status !== 'READY' && item.status !== 'WARNING')) return;
        if (selectedIndices.includes(index)) {
            onSelectChange(selectedIndices.filter(i => i !== index));
        } else {
            onSelectChange([...selectedIndices, index]);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'READY': return <IconWrap color="#2f9e44" bg="rgba(47,158,68,0.12)"><IconCheck size={16} /></IconWrap>;
            case 'WARNING': return <IconWrap color="#f08c00" bg="rgba(240,140,0,0.12)"><IconAlertTriangle size={16} /></IconWrap>;
            case 'ERROR': return <IconWrap color="#e03131" bg="rgba(224,49,49,0.12)"><IconX size={16} /></IconWrap>;
            default: return null;
        }
    };

    const isAllSelected = items.length > 0 && selectedIndices.length === items.filter(i => i.status === 'READY' || i.status === 'WARNING').length;
    const hasIndeterminate = selectedIndices.length > 0 && !isAllSelected;

    const linkSummary = React.useMemo(() => {
        const vals = Object.values(linkStatuses);
        return {
            ok: vals.filter(v => v.status === 'ok').length,
            warn: vals.filter(v => v.status === 'warn').length,
            invalid: vals.filter(v => v.status === 'invalid').length,
            loading: vals.filter(v => v.status === 'loading').length,
            total: vals.filter(v => v.status !== 'empty').length,
        };
    }, [linkStatuses]);

    const columns = [
        {
            title: <Checkbox checked={isAllSelected} indeterminate={hasIndeterminate} onChange={toggleAll} />,
            key: 'select',
            width: 40,
            render: (_: unknown, item: any, idx: number) => (
                <Checkbox
                    checked={selectedIndices.includes(idx)}
                    onChange={() => toggleItem(idx)}
                    disabled={item.status !== 'READY' && item.status !== 'WARNING'}
                />
            ),
        },
        { title: 'Estado', key: 'status', width: 60, align: 'center' as const, render: (_: unknown, item: any) => getStatusIcon(item.status) },
        {
            title: 'ID Muestra / Archivo', key: 'idmuestra', width: 200,
            render: (_: unknown, item: any, idx: number) => (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                    <Button type="text" size="small" icon={<IconEye size={16} />} onClick={() => { setPreviewItem(item); setPreviewIndex(idx); }} title="Ver detalles extraídos" />
                    <div>
                        <Text strong style={{ fontSize: 13, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={item.idMuestra || item.filename}>
                            {item.idMuestra || item.filename}
                        </Text>
                        {item.excelRow && <Text type="secondary" style={{ fontSize: 10 }}>fila Excel {item.excelRow}</Text>}
                    </div>
                </div>
            ),
        },
        {
            title: 'Cliente', key: 'cliente', width: 160,
            render: (_: unknown, item: any) => {
                const ants = item.antecedentes || {};
                return ants._clienteNombre
                    ? <Text style={{ fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={ants._clienteNombre}>{ants._clienteNombre}</Text>
                    : <Text type="danger" style={{ fontSize: 12 }}>No encontrado</Text>;
            },
        },
        {
            title: 'Empresa Srv.', key: 'empresa', width: 160,
            render: (_: unknown, item: any) => {
                const ants = item.antecedentes || {};
                return <Text type="secondary" style={{ fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={ants._empresaNombre || '-'}>{ants._empresaNombre || '-'}</Text>;
            },
        },
        {
            title: 'Fuente Emisora', key: 'fuente', width: 150,
            render: (_: unknown, item: any) => {
                const ants = item.antecedentes || {};
                return ants._fuenteNombre
                    ? <Text style={{ fontSize: 12, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={ants._fuenteNombre}>{ants._fuenteNombre}</Text>
                    : <Text type="danger" style={{ fontSize: 12 }}>No encontrado</Text>;
            },
        },
        {
            title: 'Objetivo', key: 'objetivo', width: 130,
            render: (_: unknown, item: any) => {
                const ants = item.antecedentes || {};
                return <Text type="secondary" style={{ fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={ants._objetivoNombre || '-'}>{ants._objetivoNombre || '-'}</Text>;
            },
        },
        {
            title: 'Análisis (#)', key: 'analisis',
            render: (_: unknown, item: any) => {
                const validAnalyses = item.analisis?.filter((a: any) => a._matched) || [];
                const totalAnalyses = item.analisis?.length || 0;
                return (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Tag color={totalAnalyses === 0 ? 'red' : (validAnalyses.length === totalAnalyses ? 'blue' : 'orange')} icon={<IconFlask size={12} style={{ verticalAlign: 'text-bottom' }} />}>
                            {validAnalyses.length} / {totalAnalyses}
                        </Tag>
                        {item._normativa && (
                            <Tooltip title={item._normativa}>
                                <Tag style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item._normativa}</Tag>
                            </Tooltip>
                        )}
                    </div>
                );
            },
        },
        {
            title: 'UF Total', key: 'uf', width: 90,
            render: (_: unknown, item: any) => (
                <Text strong style={{ fontSize: 12, color: (item._ufTotal || 0) > 0 ? '#2f9e44' : 'var(--app-text-secondary)' }}>
                    {(item._ufTotal || 0) > 0 ? `${Number(item._ufTotal).toFixed(2)} UF` : '-'}
                </Text>
            ),
        },
        {
            title: 'Ubicación', key: 'ubicacion', width: 70, align: 'center' as const,
            render: (_: unknown, _item: any, idx: number) => {
                const ls = linkStatuses[idx];
                if (!ls || ls.status === 'empty') return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
                if (ls.status === 'loading') return <Spin size="small" />;
                if (ls.status === 'ok') return (
                    <Tooltip title={`Lat: ${ls.lat?.toFixed(5)} · Lon: ${ls.lon?.toFixed(5)}`}>
                        <IconWrap color="#2f9e44" bg="rgba(47,158,68,0.12)" size={22}><IconCheck size={12} /></IconWrap>
                    </Tooltip>
                );
                if (ls.status === 'warn') return (
                    <Tooltip title="Link válido pero sin coordenadas extraíbles. Se guardará sin ubicación de ruta.">
                        <IconWrap color="#f08c00" bg="rgba(240,140,0,0.12)" size={22}><IconAlertTriangle size={12} /></IconWrap>
                    </Tooltip>
                );
                return (
                    <Tooltip title="Link inválido.">
                        <IconWrap color="#e03131" bg="rgba(224,49,49,0.12)" size={22}><IconX size={12} /></IconWrap>
                    </Tooltip>
                );
            },
        },
        {
            title: 'Problemas', key: 'problemas', width: 80, align: 'center' as const,
            render: (_: unknown, item: any) => {
                const hasErrors = item.errors?.length > 0 || item.analysisErrors?.length > 0;
                const hasWarnings = item.warnings?.length > 0;
                if (!hasErrors && !hasWarnings) return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
                const count = (item.errors?.length || 0) + (item.analysisErrors?.length || 0) + (item.warnings?.length || 0);
                return (
                    <Popover
                        placement="left"
                        content={
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 350 }}>
                                {item.errors?.map((err: any, i: number) => (
                                    <Alert key={`err-${i}`} type="error" showIcon icon={<IconX size={16} />} message={err.field} description={<Text style={{ fontSize: 12 }}>{err.message}</Text>} />
                                ))}
                                {item.analysisErrors?.map((err: any, i: number) => {
                                    const msg = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
                                    const title = (err && typeof err === 'object' && err.field) ? err.field : 'Análisis';
                                    return (
                                        <Alert key={`aerr-${i}`} type="warning" showIcon icon={<IconAlertTriangle size={16} />} message={title} description={<Text style={{ fontSize: 12 }}>{msg}</Text>} />
                                    );
                                })}
                                {item.warnings?.map((warn: any, i: number) => (
                                    <Alert key={`warn-${i}`} type="warning" showIcon icon={<IconAlertTriangle size={16} />} message={warn.field} description={<Text style={{ fontSize: 12 }}>{warn.message}</Text>} />
                                ))}
                            </div>
                        }
                    >
                        <Badge count={count} size="small" color={hasErrors ? '#e03131' : '#f08c00'}>
                            <Button type="text" size="small" icon={<IconInfoCircle size={20} color={hasErrors ? '#e03131' : '#f08c00'} />} />
                        </Badge>
                    </Popover>
                );
            },
        },
    ];

    return (
        <>
            {linkSummary.total > 0 && (
                <Alert
                    type={linkSummary.warn > 0 || linkSummary.invalid > 0 ? 'warning' : 'success'}
                    showIcon
                    icon={<IconMapPin size={16} />}
                    style={{ marginBottom: 8 }}
                    message={
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Text strong style={{ fontSize: 12 }}>Ubicaciones Google Maps:</Text>
                            {linkSummary.loading > 0 && <Text type="secondary" style={{ fontSize: 12 }}>Verificando {linkSummary.loading}…</Text>}
                            {linkSummary.ok > 0 && <Text style={{ fontSize: 12, color: '#2f9e44' }}>✓ {linkSummary.ok} detectada{linkSummary.ok !== 1 ? 's' : ''}</Text>}
                            {linkSummary.warn > 0 && <Text style={{ fontSize: 12, color: '#e8590c' }}>⚠ {linkSummary.warn} sin coordenadas</Text>}
                            {linkSummary.invalid > 0 && <Text style={{ fontSize: 12, color: '#e03131' }}>✗ {linkSummary.invalid} inválido{linkSummary.invalid !== 1 ? 's' : ''}</Text>}
                            {linkSummary.warn > 0 && <Text type="secondary" style={{ fontSize: 12 }}>(se guardarán sin coordenadas de ruta)</Text>}
                        </div>
                    }
                />
            )}
            <Table
                dataSource={items}
                columns={columns}
                rowKey={(_item, idx) => idx as number}
                pagination={false}
                size="small"
                scroll={{ y: 500 }}
                locale={{ emptyText: 'No hay elementos para mostrar' }}
                onRow={(item: any) => ({
                    style: item.status === 'ERROR' ? { backgroundColor: 'rgba(224,49,49,0.05)' } : undefined,
                })}
            />

            <Modal
                open={!!previewItem}
                onCancel={() => { setPreviewItem(null); setPreviewIndex(-1); }}
                footer={null}
                width="75%"
                styles={{ body: { padding: 0 } }}
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconEye size={20} color="#1c7ed6" />
                        <Text strong>Vista Previa: {previewItem?.idMuestra || previewItem?.filename}</Text>
                    </div>
                }
            >
                {previewItem && (
                    <Tabs
                        defaultActiveKey="antecedentes"
                        style={{ padding: '0 16px' }}
                        items={[
                            {
                                key: 'antecedentes',
                                label: <span><IconClipboardList size={18} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Antecedentes</span>,
                                children: (
                                    <div style={{ padding: '24px 8px', backgroundColor: 'var(--app-hover-bg)' }}>
                                        <PreviewAntecedentes previewItem={previewItem} previewIndex={previewIndex} linkStatuses={linkStatuses} cleanLink={cleanLink} />
                                    </div>
                                ),
                            },
                            {
                                key: 'analisis',
                                label: <span><IconFlask size={18} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Análisis</span>,
                                children: (
                                    <div style={{ padding: '24px 8px', backgroundColor: 'var(--app-hover-bg)' }}>
                                        <PreviewAnalisis previewItem={previewItem} />
                                    </div>
                                ),
                            },
                            {
                                key: 'auditoria',
                                label: <span><IconCodeDots size={18} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Auditoría de Match</span>,
                                children: (
                                    <div style={{ padding: '24px 8px' }}>
                                        <PreviewAuditoria previewItem={previewItem} />
                                    </div>
                                ),
                            },
                        ]}
                    />
                )}
            </Modal>
        </>
    );
};

function IconWrap({ children, color, bg, size = 24 }: { children: React.ReactNode; color: string; bg: string; size?: number }) {
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', backgroundColor: bg, color,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
            {children}
        </div>
    );
}

function StaticField({ label, value }: { label: string; value: any }) {
    return (
        <div>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{label}</Text>
            <Card size="small" style={{ marginTop: 2 }}>
                <Text strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={String(value || '-')}>
                    {value || '-'}
                </Text>
            </Card>
        </div>
    );
}

function PreviewAntecedentes({ previewItem, previewIndex, linkStatuses, cleanLink }: { previewItem: any; previewIndex: number; linkStatuses: Record<number, LinkStatus>; cleanLink: (l?: string) => string }) {
    const ants = previewItem.antecedentes || {};
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <StaticField label="Monitoreo" value={ants.tipoMonitoreo} />
                <StaticField label="Base Operaciones" value={ants._lugarNombre || 'No Aplica'} />
                <StaticField label="Cliente" value={ants._clienteNombre} />
                <StaticField label="Empresa Servicio" value={ants._empresaNombre} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <StaticField label="Fuente Emisora" value={ants._fuenteNombre} />
                <StaticField label="Código Centro" value={ants.codigoCentro} />
                <StaticField label="ID Centro" value={ants.idCentro || ants.selectedFuente} />
                <StaticField label="Tipo Agua" value={ants.tipoAgua} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <StaticField label="Comuna" value={ants.comuna} />
                <StaticField label="Región" value={ants.region} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <StaticField label="Contacto" value={ants.contactoNombre} />
                <StaticField label="E-mail" value={ants.contactoEmail} />
                <StaticField label="Objetivo" value={ants._objetivoNombre} />
                <StaticField label="Ubicación" value={ants.ubicacion} />
            </div>

            <StaticField label="Tabla / Glosa" value={ants.glosa} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <StaticField label="Es ETFA" value={ants.esETFA || (ants.etfa ? 'Sí' : 'No')} />
                <StaticField label="Inspector" value={ants._inspectorNombre} />
                <StaticField label="Punto de Muestreo" value={ants.puntoMuestreo} />
                <StaticField label="Responsable" value={ants.responsableMuestreo} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <StaticField label="Instrumento" value={ants.instrumentoFull || ants.selectedInstrumento || '-'} />
                <StaticField label="Ref. Google Maps" value={(() => {
                    const ls = linkStatuses[previewIndex];
                    if (!cleanLink(ants.refGoogle)) return 'Sin enlace';
                    if (!ls || ls.status === 'loading') return '⏳ Verificando…';
                    if (ls.status === 'ok') return `✓ Lat: ${ls.lat?.toFixed(6)}, Lon: ${ls.lon?.toFixed(6)}`;
                    if (ls.status === 'warn') return '⚠ Sin coordenadas extraíbles';
                    return '✗ Link inválido';
                })()} />
                <StaticField label="Zona UTM" value={ants.zona} />
                <StaticField label="Coordenadas" value={ants.utmNorte && ants.utmEste ? `N ${ants.utmNorte} / E ${ants.utmEste}` : '-'} />
            </div>

            <Divider>Frecuencia y Programación</Divider>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <StaticField label="Frecuencia" value={ants.frecuencia} />
                <StaticField label="Periodo" value={ants._periodoNombre} />
                <StaticField label="Factor" value={ants.factor} />
                <StaticField label="Total Servicios" value={ants.totalServicios} />
            </div>

            <Divider>Detalles del Servicio</Divider>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <StaticField label="Componente" value={ants._componenteNombre} />
                <StaticField label="Sub Área" value={ants._subAreaNombre} />
                <StaticField label="Duración (hrs)" value={ants.duracion} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <StaticField label="Cargo" value={ants._cargoNombre || ants.cargoResponsable} />
                <StaticField label="Tipo Muestreo" value={ants._tipoMuestreoNombre} />
                <StaticField label="Medición Caudal" value={ants.medicionCaudal} />
                <StaticField label="Normativa" value={ants._normativaNombre} />
            </div>

            {ants.observaciones && (
                <Alert type="info" showIcon icon={<IconInfoCircle size={16} />} message="Observaciones" description={<Text style={{ fontSize: 13 }}>{ants.observaciones}</Text>} />
            )}
        </div>
    );
}

function PreviewAnalisis({ previewItem }: { previewItem: any }) {
    const co = previewItem.costoOperativo || { activo: false, uf: 0 };
    const sumAnal = (previewItem.analisis || []).reduce((s: number, a: any) => s + (parseFloat(a.uf_individual) || 0), 0);
    const costoUF = co.activo ? Number(co.uf || 0) : 0;
    const ufTotal = sumAnal + costoUF;

    const analisisColumns = [
        {
            title: 'Estado Match', key: 'match',
            render: (_: unknown, row: any) => {
                if (row.__costoOperativo) return <Tag color={row.costoUF > 0 ? 'gold' : 'default'}>{row.costoUF > 0 ? 'Activo' : 'Inactivo'}</Tag>;
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Tag color={row._matched ? 'green' : 'red'}>{row._matched ? 'OK' : 'No Encontrado'}</Tag>
                        {row._errors?.length > 0 && (
                            <Tooltip title={row._errors.join(', ')}>
                                <IconAlertTriangle size={14} color="#e03131" style={{ cursor: 'help' }} />
                            </Tooltip>
                        )}
                    </div>
                );
            },
        },
        {
            title: 'Análisis', key: 'nombre',
            render: (_: unknown, row: any) => {
                if (row.__costoOperativo) return <Text strong style={{ fontSize: 12, color: row.costoUF > 0 ? '#e8a600' : 'var(--app-text-secondary)' }}>Costo Operativo</Text>;
                return row._matched
                    ? <Text strong style={{ fontSize: 12 }} title={row.nombre_original}>{row.nombre_original}</Text>
                    : <Text type="danger" strong style={{ fontSize: 12 }} title={row.nombre_original}>{row.nombre_original}</Text>;
            },
        },
        { title: 'Normativa', key: 'normativa', render: (_: unknown, row: any) => row.__costoOperativo ? <Text type="secondary" style={{ fontSize: 12 }}>—</Text> : <Text style={{ fontSize: 12 }} title={row.nombre_normativa || row._normativaNombre || previewItem._normativa || '-'}>{row.nombre_normativa || row._normativaNombre || previewItem._normativa || '-'}</Text> },
        { title: 'Tabla / Referencia', key: 'referencia', render: (_: unknown, row: any) => row.__costoOperativo ? <Text type="secondary" style={{ fontSize: 12 }}>—</Text> : <Text style={{ fontSize: 12 }} title={row.nombre_normativareferencia || row._normativaRefNombre || previewItem._normativaRef || '-'}>{row.nombre_normativareferencia || row._normativaRefNombre || previewItem._normativaRef || '-'}</Text> },
        { title: 'Tipo Muestra', key: 'tipo', render: (_: unknown, row: any) => row.__costoOperativo ? <Text type="secondary" style={{ fontSize: 12 }}>—</Text> : row.tipo_analisis },
        { title: 'Límite Min', key: 'limmin', align: 'right' as const, render: (_: unknown, row: any) => row.__costoOperativo ? <Text type="secondary" style={{ fontSize: 12 }}>—</Text> : row.limitemax_d },
        { title: 'Límite Max', key: 'limmax', align: 'right' as const, render: (_: unknown, row: any) => row.__costoOperativo ? <Text type="secondary" style={{ fontSize: 12 }}>—</Text> : row.limitemax_h },
        { title: 'Tipo Entrega', key: 'entrega', render: (_: unknown, row: any) => row.__costoOperativo ? <Text type="secondary" style={{ fontSize: 12 }}>—</Text> : row.tipo_entrega_texto },
        { title: 'Lab. Principal', key: 'lab', render: (_: unknown, row: any) => row.__costoOperativo ? <Text type="secondary" style={{ fontSize: 12 }}>—</Text> : row.laboratorio_texto },
        {
            title: 'UF Individual', key: 'uf', align: 'right' as const,
            render: (_: unknown, row: any) => {
                if (row.__costoOperativo) return <Text strong style={{ fontSize: 12, color: row.costoUF > 0 ? '#e8a600' : 'var(--app-text-secondary)' }}>{row.costoUF > 0 ? row.costoUF.toFixed(2) : 'No aplica'}</Text>;
                return (
                    <Text strong style={{ fontSize: 12, color: row.uf_individual > 0 ? '#2f9e44' : 'var(--app-text-secondary)' }}>
                        {row.uf_individual > 0 ? parseFloat(row.uf_individual).toFixed(2) : '-'}
                    </Text>
                );
            },
        },
    ];

    const costoOperativoRow = {
        __costoOperativo: true,
        costoUF,
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Card size="small" style={{ backgroundColor: 'var(--app-accent-bg)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Normativa (ficha):</Text>
                        <Text strong style={{ fontSize: 12 }}>{previewItem._normativa || '-'}</Text>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Referencia (ficha):</Text>
                        <Text strong style={{ fontSize: 12 }}>{previewItem._normativaRef || '-'}</Text>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Costo Operativo:</Text>
                        <Tag color={co.activo && costoUF > 0 ? 'gold' : 'default'}>{co.activo && costoUF > 0 ? `${costoUF.toFixed(2)} UF` : 'No aplica'}</Tag>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                        <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>UF Total:</Text>
                        <Text strong style={{ fontSize: 12, color: '#2f9e44' }}>{ufTotal.toFixed(2)} UF</Text>
                    </div>
                </div>
                <Text type="secondary" italic style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                    Cada análisis puede pertenecer a una normativa/tabla distinta. La normativa de la ficha es la dominante para la cabecera.
                </Text>
            </Card>

            <Table
                dataSource={[...(previewItem.analisis || []), costoOperativoRow]}
                rowKey={(_row, i) => i as number}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
                columns={analisisColumns as any}
                onRow={(row: any) => ({
                    style: row.__costoOperativo
                        ? { backgroundColor: row.costoUF > 0 ? 'rgba(240,140,0,0.06)' : 'var(--app-hover-bg)' }
                        : (!row._matched ? { backgroundColor: 'rgba(240,140,0,0.06)' } : undefined),
                })}
            />
        </div>
    );
}

function PreviewAuditoria({ previewItem }: { previewItem: any }) {
    return (
        <div style={{ marginTop: 16 }}>
            <Text type="secondary" strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>MODO DESARROLLADOR: AUDITORÍA DE EXTRACCIÓN Y MATCH</Text>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
                <div>
                    <Text style={{ fontSize: 10, fontWeight: 600, display: 'block' }}>Cliente Match</Text>
                    <Tag>{previewItem.antecedentes?._clienteMatch_method || 'fuzzy'}</Tag>
                </div>
                <div>
                    <Text style={{ fontSize: 10, fontWeight: 600, display: 'block' }}>Fuente Match</Text>
                    <Tag>{previewItem.antecedentes?._fuenteMatch_method || 'fuzzy'}</Tag>
                </div>
                <div>
                    <Text style={{ fontSize: 10, fontWeight: 600, display: 'block' }}>Sede Match</Text>
                    <Tag>{previewItem.antecedentes?._lugarMatch_method || 'fuzzy'}</Tag>
                </div>
            </div>
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
                <pre style={{
                    backgroundColor: '#f8f9fa',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    border: '1px solid #e9ecef',
                    margin: 0,
                    color: '#1e293b',
                }}>
                    {JSON.stringify(
                        {
                            insert_payload: {
                                encabezado: previewItem.antecedentes,
                                analisis: previewItem.analisis.map((a: any) => ({
                                    ra_id: a.id_referenciaanalisis,
                                    tec_id: a.id_tecnica,
                                    lab_id: a.id_laboratorioensayo,
                                    tipo: a.tipo_analisis
                                }))
                            }
                        },
                        null, 2)}
                </pre>
            </div>
        </div>
    );
}
