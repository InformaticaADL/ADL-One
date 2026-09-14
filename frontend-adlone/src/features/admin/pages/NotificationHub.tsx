import React, { useState, useEffect } from 'react';
import {
    Typography,
    Input,
    Button,
    Spin,
    Collapse,
    Tooltip,
    Tag
} from 'antd';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconLayoutDashboard,
    IconChevronRight,
    IconBell,
    IconSearch,
    IconRefresh,
    IconShield,
    IconLeaf,
    IconUserCircle,
    IconServer,
    IconBolt,
    IconLayoutGrid
} from '@tabler/icons-react';
import { notificationService } from '../../../services/notification.service';
import { useToast } from '../../../contexts/ToastContext';
import { EventRow } from '../components/notifications/EventRow';
import { RecipientModal } from '../components/notifications/RecipientModal';
import { PageHeader } from '../../../components/layout/PageHeader';

const { Title, Text } = Typography;

interface Module {
    id: string | number;
    nombre: string;
    icono?: string;
    funcionalidades: Funcionalidad[];
}

interface Funcionalidad {
    id: number;
    nombre: string;
    eventos: any[];
}

export const NotificationHub: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();
    const [catalog, setCatalog] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeModuleId, setActiveModuleId] = useState<string | number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        loadCatalog();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadCatalog = async () => {
        try {
            setLoading(true);
            const data = await notificationService.getNotificationCatalog();

            const processedModules: Module[] = [];
            const dynamicEvents: any[] = [];

            data.forEach((mod: any) => {
                const cleanMod = { ...mod, funcionalidades: [] };
                mod.funcionalidades.forEach((func: any) => {
                    const normalEvents: any[] = [];
                    func.eventos.forEach((ev: any) => {
                        if (ev.es_transaccional) {
                            dynamicEvents.push(ev);
                        } else {
                            normalEvents.push(ev);
                        }
                    });
                    if (normalEvents.length > 0) {
                        cleanMod.funcionalidades.push({ ...func, eventos: normalEvents });
                    }
                });
                if (cleanMod.funcionalidades.length > 0) {
                    processedModules.push(cleanMod);
                }
            });

            if (dynamicEvents.length > 0) {
                processedModules.push({
                    id: 'dynamic-events',
                    nombre: 'Eventos Dinámicos',
                    icono: 'zap',
                    funcionalidades: [
                        {
                            id: 999999,
                            nombre: 'Notificaciones Transaccionales',
                            eventos: dynamicEvents
                        }
                    ]
                });
            }

            setCatalog(processedModules);

            if (processedModules.length > 0 && !activeModuleId) {
                setActiveModuleId(processedModules[0].id || processedModules[0].nombre);
            }
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar el catálogo de notificaciones' });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenSettings = (event: any) => {
        setSelectedEvent(event);
        setIsModalOpen(true);
    };

    const activeModule = catalog.find(m => (m.id || m.nombre) === activeModuleId);

    const filteredFuncionalidades = activeModule ? activeModule.funcionalidades.map(func => {
        const filteredEvents = func.eventos.filter(ev =>
            (ev.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (ev.codigo || ev.codigo_evento || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

        return {
            ...func,
            eventos: filteredEvents,
            matchesName: (func.nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
        };
    }).filter(func => func.eventos.length > 0 || func.matchesName) : [];

    const getModuleIcon = (name: string, isActive?: boolean) => {
        const n = name.toUpperCase();
        const iconSize = 18;
        const color = isActive ? '#fff' : '#0062a8';

        if (n.includes('DINÁMICOS')) return <IconBolt size={iconSize} color={color} />;
        if (n.includes('MEDIO') || n.includes('AMBIENTE')) return <IconLeaf size={iconSize} color={color} />;
        if (n.includes('ADMIN') || n.includes('SISTEMA')) return <IconShield size={iconSize} color={color} />;
        if (n.includes('USUARIO')) return <IconUserCircle size={iconSize} color={color} />;
        return <IconServer size={iconSize} color={color} />;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <PageHeader
                title="Hub de Notificaciones"
                subtitle="Administre destinatarios y canales de alerta para todo el sistema."
                onBack={onBack}
                rightSection={
                    <div style={{ display: 'flex', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap', flex: 1 }}>
                        <Input
                            placeholder="Buscar evento o sección..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            prefix={<IconSearch size={16} color="var(--app-text-secondary)" />}
                            style={{ width: isMobile ? '100%' : 300 }}
                        />
                        <Tooltip title="Refrescar catálogo">
                            <Button
                                type="primary"
                                shape="circle"
                                size="large"
                                icon={<IconRefresh size={18} />}
                                onClick={loadCatalog}
                                loading={loading && catalog.length > 0}
                            />
                        </Tooltip>
                    </div>
                }
            />

            {loading && catalog.length === 0 ? (
                <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <Spin size="large" />
                        <Text type="secondary" style={{ fontSize: 13 }}>Sincronizando catálogo universal...</Text>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 9fr', gap: 32 }}>
                    {/* Navigation sidebar */}
                    <div style={{ backgroundColor: 'var(--app-hover-bg)', borderRadius: 16, padding: 16 }}>
                        <Text type="secondary" strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 16, padding: '0 8px' }}>
                            Módulos del Sistema
                        </Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {catalog.map(mod => {
                                const modId = mod.id || mod.nombre;
                                const isActive = activeModuleId === modId;
                                return (
                                    <div
                                        key={modId}
                                        onClick={() => {
                                            setActiveModuleId(modId);
                                            setSearchTerm('');
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8,
                                            cursor: 'pointer', fontWeight: 600, transition: 'all 200ms ease',
                                            backgroundColor: isActive ? '#0062a8' : 'transparent',
                                            color: isActive ? '#fff' : 'var(--app-text)',
                                        }}
                                    >
                                        <div style={{
                                            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                                            backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : 'var(--app-accent-bg)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {getModuleIcon(mod.nombre, isActive)}
                                        </div>
                                        <Text style={{ fontSize: 13, fontWeight: 600, flex: 1, color: isActive ? '#fff' : undefined }}>{mod.nombre}</Text>
                                        {isActive && <IconChevronRight size={14} />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main content area */}
                    <div>
                        {activeModule ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <IconLayoutGrid size={24} color="#0062a8" />
                                        <Title level={3} style={{ margin: 0 }}>{activeModule.nombre}</Title>
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 13 }}>
                                        {searchTerm ? `Resultados de búsqueda en "${activeModule.nombre}"` : `${activeModule.funcionalidades.length} funcionalidades configuradas.`}
                                    </Text>
                                </div>

                                {filteredFuncionalidades.length === 0 ? (
                                    <div style={{ padding: 32, borderRadius: 8, border: '1px dashed var(--app-border)', textAlign: 'center' }}>
                                        <Text type="secondary">No se encontraron eventos coincidentes.</Text>
                                    </div>
                                ) : (
                                    <Collapse
                                        accordion
                                        expandIconPosition="end"
                                        items={filteredFuncionalidades.map(func => ({
                                            key: String(func.id),
                                            label: (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'var(--app-accent-bg)', color: '#0062a8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                        <IconLayoutDashboard size={18} />
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1, paddingRight: 16 }}>
                                                        <Text strong style={{ fontSize: 15 }}>{func.nombre}</Text>
                                                        <Tag>{func.eventos.length} eventos</Tag>
                                                    </div>
                                                </div>
                                            ),
                                            children: (
                                                <div>
                                                    {func.eventos.map((ev: any) => (
                                                        <EventRow
                                                            key={ev.id}
                                                            event={ev}
                                                            onOpenSettings={handleOpenSettings}
                                                            onStatusChange={loadCatalog}
                                                        />
                                                    ))}
                                                </div>
                                            ),
                                        }))}
                                    />
                                )}
                            </div>
                        ) : (
                            <div style={{ height: 400, backgroundColor: 'var(--app-hover-bg)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                    <IconBell size={48} color="var(--app-text-secondary)" strokeWidth={1} />
                                    <Text type="secondary">Seleccione un módulo para comenzar la configuración.</Text>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <RecipientModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                event={selectedEvent}
                onSaved={loadCatalog}
            />
        </div>
    );
};
