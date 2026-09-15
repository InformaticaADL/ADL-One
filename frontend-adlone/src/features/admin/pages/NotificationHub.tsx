import React, { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

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

    const getModuleIcon = (name: string) => {
        const n = name.toUpperCase();
        const iconSize = 18;

        if (n.includes('DINÁMICOS')) return <IconBolt size={iconSize} />;
        if (n.includes('MEDIO') || n.includes('AMBIENTE')) return <IconLeaf size={iconSize} />;
        if (n.includes('ADMIN') || n.includes('SISTEMA')) return <IconShield size={iconSize} />;
        if (n.includes('USUARIO')) return <IconUserCircle size={iconSize} />;
        return <IconServer size={iconSize} />;
    };

    return (
        <div className="shadcn-scope flex w-full flex-col gap-6 p-4 md:p-6">
            <PageHeader
                title="Hub de Notificaciones"
                subtitle="Administre destinatarios y canales de alerta para todo el sistema."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Administración', onClick: onBack }, { label: 'Notificaciones' }]}
                rightSection={
                    <div className={cn('flex flex-1 gap-3', isMobile ? 'flex-wrap' : 'flex-nowrap')}>
                        <div className="relative" style={{ width: isMobile ? '100%' : 300 }}>
                            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Buscar evento o sección..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Button
                            size="icon"
                            title="Refrescar catálogo"
                            className="rounded-full"
                            onClick={loadCatalog}
                            disabled={loading && catalog.length > 0}
                        >
                            {loading && catalog.length > 0 ? (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                            ) : (
                                <IconRefresh size={18} />
                            )}
                        </Button>
                    </div>
                }
            />

            {loading && catalog.length === 0 ? (
                <div className="flex h-[400px] flex-col items-center justify-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">Sincronizando catálogo universal...</p>
                </div>
            ) : (
                <div className="grid gap-8" style={{ gridTemplateColumns: isMobile ? '1fr' : '3fr 9fr' }}>
                    {/* Navigation sidebar */}
                    <div className="rounded-2xl bg-muted/40 p-4">
                        <p className="mb-4 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Módulos del Sistema
                        </p>
                        <div className="flex flex-col gap-1">
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
                                        className={cn(
                                            'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                                            isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'
                                        )}
                                    >
                                        <div className={cn(
                                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                                            isActive ? 'bg-white/15' : 'bg-background'
                                        )}>
                                            {getModuleIcon(mod.nombre)}
                                        </div>
                                        <span className="flex-1 truncate">{mod.nombre}</span>
                                        {isActive && <IconChevronRight size={14} />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main content area */}
                    <div>
                        {activeModule ? (
                            <div className="flex flex-col gap-6">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <IconLayoutGrid size={24} className="text-primary" />
                                        <h2 className="text-xl font-semibold text-foreground">{activeModule.nombre}</h2>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {searchTerm ? `Resultados de búsqueda en "${activeModule.nombre}"` : `${activeModule.funcionalidades.length} funcionalidades configuradas.`}
                                    </p>
                                </div>

                                {filteredFuncionalidades.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border p-8 text-center">
                                        <p className="text-sm text-muted-foreground">No se encontraron eventos coincidentes.</p>
                                    </div>
                                ) : (
                                    <Accordion type="single" collapsible className="flex flex-col gap-2">
                                        {filteredFuncionalidades.map(func => (
                                            <AccordionItem key={func.id} value={String(func.id)}>
                                                <AccordionTrigger>
                                                    <div className="flex flex-1 items-center gap-3 pr-2">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                            <IconLayoutDashboard size={18} />
                                                        </div>
                                                        <div className="flex flex-1 items-center justify-between">
                                                            <span className="text-[15px] font-semibold text-foreground">{func.nombre}</span>
                                                            <Badge variant="outline">{func.eventos.length} eventos</Badge>
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="flex flex-col gap-2 pt-1">
                                                        {func.eventos.map((ev: any) => (
                                                            <EventRow
                                                                key={ev.id}
                                                                event={ev}
                                                                onOpenSettings={handleOpenSettings}
                                                                onStatusChange={loadCatalog}
                                                            />
                                                        ))}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )}
                            </div>
                        ) : (
                            <div className="flex h-[400px] items-center justify-center rounded-2xl bg-muted/40">
                                <div className="flex flex-col items-center gap-2">
                                    <IconBell size={48} strokeWidth={1} className="text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">Seleccione un módulo para comenzar la configuración.</p>
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
