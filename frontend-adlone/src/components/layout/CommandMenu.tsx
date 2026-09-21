import { useEffect, useMemo, useState, type ElementType } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavStore } from '../../store/navStore';
import { getIconComponent } from '../../config/iconRegistry';
import { FIXED_TOP_MODULES, hasAccess, canAccessModule, type DynamicModule } from '../../config/sidebarModules';
import { cn } from '@/lib/utils';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';

interface CommandEntry {
    key: string;
    label: string; // texto visible del ítem (sin el nombre del módulo padre)
    searchValue: string; // "Módulo Sub-ítem" — así buscar el nombre del módulo también encuentra sus sub-páginas
    group: string;
    Icon: ElementType;
    moduleId: string;
    submoduleId: string;
}

interface CommandMenuProps {
    isCollapsed: boolean;
    onNavigate?: () => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

// Buscador global del sidebar — reemplaza el filtro-en-el-árbol anterior por
// un command palette (cmdk) que indexa TODAS las páginas (fijas + dinámicas
// + sus sub-ítems) de una sola vez, en vez de solo lo que ya está visible/
// desplegado en el árbol. Se abre con click o Ctrl/Cmd+K desde cualquier
// parte de la app mientras el sidebar está montado.
export function CommandMenu({ isCollapsed, onNavigate }: CommandMenuProps) {
    const { hasPermission } = useAuth();
    const { setActiveModule, setActiveSubmodule, dynamicModules: rawDynamicModules } = useNavStore();
    const dynamicModules = rawDynamicModules as unknown as DynamicModule[];
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen((o) => !o);
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    const groups = useMemo(() => {
        const entries: CommandEntry[] = [];

        for (const m of FIXED_TOP_MODULES) {
            if (!hasAccess(m.permission, hasPermission)) continue;
            if (m.links && m.links.length > 0) {
                for (const link of m.links) {
                    if (!hasAccess(link.permission, hasPermission)) continue;
                    entries.push({
                        key: `${m.id}::${link.id}`, label: link.label, searchValue: `${m.label} ${link.label}`,
                        group: m.label, Icon: m.icon, moduleId: m.id, submoduleId: link.id,
                    });
                }
            } else {
                entries.push({ key: m.id, label: m.label, searchValue: m.label, group: 'Principal', Icon: m.icon, moduleId: m.id, submoduleId: '' });
            }
        }

        const pushDynamic = (mod: DynamicModule, fallbackGroup: string) => {
            if (!canAccessModule(mod, hasPermission)) return;
            const Icon = getIconComponent(mod.icon);
            if (mod.links && mod.links.length > 0) {
                for (const link of mod.links) {
                    if (!hasAccess(link.permission, hasPermission)) continue;
                    entries.push({
                        key: `${mod.id}::${link.id}`, label: link.label, searchValue: `${mod.label} ${link.label}`,
                        group: mod.label, Icon, moduleId: mod.id, submoduleId: link.id,
                    });
                }
            } else {
                entries.push({ key: mod.id, label: mod.label, searchValue: mod.label, group: fallbackGroup, Icon, moduleId: mod.id, submoduleId: '' });
            }
        };

        for (const mod of dynamicModules.filter((m) => m.group === 'unidades')) pushDynamic(mod, 'Unidades');
        for (const mod of dynamicModules.filter((m) => m.group === 'gestion')) pushDynamic(mod, 'Gestión');

        const map = new Map<string, CommandEntry[]>();
        for (const entry of entries) {
            if (!map.has(entry.group)) map.set(entry.group, []);
            map.get(entry.group)!.push(entry);
        }
        return Array.from(map.entries());
    }, [dynamicModules, hasPermission]);

    const handleSelect = (entry: CommandEntry) => {
        setActiveModule(entry.moduleId);
        setActiveSubmodule(entry.submoduleId);
        setOpen(false);
        onNavigate?.();
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                title="Buscar (Ctrl+K)"
                className={cn(
                    'relative flex items-center rounded-lg border border-transparent bg-muted text-sm text-muted-foreground shadow-none transition-colors hover:bg-muted/80',
                    isCollapsed ? 'h-8 w-8 justify-center' : 'h-8 w-full pl-8 pr-2'
                )}
            >
                <IconSearch size={15} className={cn(!isCollapsed && 'pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2')} />
                {!isCollapsed && (
                    <>
                        <span className="flex-1 text-left">Buscar...</span>
                        <kbd className="pointer-events-none hidden select-none items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
                            {isMac ? '⌘' : 'Ctrl'}K
                        </kbd>
                    </>
                )}
            </button>

            <CommandDialog open={open} onOpenChange={setOpen} title="Buscar" description="Busca cualquier página o sección de la aplicación">
                <CommandInput placeholder="Buscar páginas..." />
                <CommandList>
                    <CommandEmpty>No se encontraron resultados.</CommandEmpty>
                    {groups.map(([group, groupEntries]) => (
                        <CommandGroup key={group} heading={group}>
                            {groupEntries.map((entry) => (
                                <CommandItem key={entry.key} value={entry.searchValue} onSelect={() => handleSelect(entry)}>
                                    <entry.Icon size={16} className="shrink-0 text-muted-foreground" />
                                    {entry.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ))}
                </CommandList>
            </CommandDialog>
        </>
    );
}
