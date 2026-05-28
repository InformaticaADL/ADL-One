import { useEffect, useRef } from 'react';
import { AppShell, Box, Burger, Group, Image, Alert, Text } from '@mantine/core';
import { IconWifiOff } from '@tabler/icons-react';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { useNavStore } from '../../store/navStore';
import { Sidebar } from './Sidebar';
import { HelpCenter } from '../common/HelpCenter';

import logoAdl from '../../assets/images/logo-adlone.png';
import { useNotificationStore } from '../../store/notificationStore';
import { useAuth } from '../../contexts/AuthContext';
import ContextualNotificationPanel from '../../features/notifications/components/ContextualNotificationPanel';
import { ScrollButtons } from '../common/ScrollButtons';
import { ursService } from '../../services/urs.service';

interface MainLayoutProps {
    children?: React.ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
    const isCompact = useMediaQuery('(max-width: 1200px)');
    const { 
        activeModule, 
        activeSubmodule,
        sidebarCollapsed,
        resetNavigation,
        helpCenterOpen,
        setHelpCenterOpen,
    } = useNavStore();
    const [opened, { toggle, close }] = useDisclosure();
    const viewportRef = useRef<HTMLDivElement>(null);

    // Modules that manage their own internal scroll per column — bypass wrapper padding/overflow
    const isFullHeightModule = !activeSubmodule && (activeModule === 'solicitudes' || activeModule === 'chat');

    // Auto-close sidebar on compact view when navigating (only on terminal submodule selection)
    useEffect(() => {
        if (isCompact && activeSubmodule) {
            close();
        }
    }, [activeSubmodule, isCompact, close]);

    // Global Notifications listener (Toast logic)
    const { user, token } = useAuth();
    const { fetchNotifications, initSocket, disconnectSocket, socketStatus } = useNotificationStore();
    const { setUrsUnreadCount } = useNavStore();

    // Socket Initialization + global counters fetch
    useEffect(() => {
        if (user?.id && token) {
            initSocket(user.id, token);
            fetchNotifications();
            ursService.getUnreadCount().then(setUrsUnreadCount).catch(() => {});
        }

        return () => {
            disconnectSocket();
        };
    }, [user?.id, token, initSocket, disconnectSocket, fetchNotifications, setUrsUnreadCount]);



    return (
        <AppShell
            header={{ height: { base: 60, lg: 0 } }}
            navbar={{
                width: isCompact ? 240 : (sidebarCollapsed ? 80 : 240),
                breakpoint: 'lg',
                collapsed: { mobile: !opened },
            }}
            h="100dvh"
            padding={0}
            styles={{
                header: {
                    backgroundColor: isCompact ? 'rgba(255, 255, 255, 0.4)' : 'transparent',
                    backdropFilter: isCompact ? 'blur(10px)' : 'none',
                    WebkitBackdropFilter: isCompact ? 'blur(10px)' : 'none',
                    borderBottom: isCompact ? '1px solid rgba(0, 0, 0, 0.05)' : 'none',
                },
                navbar: {
                    backgroundColor: 'rgba(255, 255, 255, 0.4)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    borderRight: '1px solid rgba(0, 0, 0, 0.05)',
                },
                main: {
                    backgroundColor: '#ffffff',
                    transition: 'padding-left 300ms ease',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    paddingLeft: isCompact ? 0 : undefined 
                }
            }}
        >
            <AppShell.Header px="md" hiddenFrom="lg">
                <Group h="100%" justify="space-between">
                    <Burger opened={opened} onClick={toggle} size="sm" />
                    <Image 
                        src={logoAdl} 
                        h={40} 
                        w="auto" 
                        fit="contain" 
                        style={{ cursor: 'pointer' }} 
                        onClick={() => {
                            resetNavigation();
                            close();
                        }}
                    />

                    <div style={{ width: 30 }} /> {/* Spacer to center the logo if needed */}
                </Group>
            </AppShell.Header>

            <AppShell.Navbar>
                <Box h="100%" pb="md">
                    <Sidebar 
                        forceNotCollapsed={isCompact} 
                        hideLogo={isCompact}
                        onNavigate={close}
                        onHelpClick={() => setHelpCenterOpen(true, true)}
                    />
                </Box>
            </AppShell.Navbar>

            <AppShell.Main>
                <Box style={{ 
                    position: 'relative', 
                    display: 'flex', 
                    flexDirection: 'column',
                    height: '100%',
                    overflow: 'hidden' 
                }}>
                    {activeModule && (
                        <ContextualNotificationPanel area={activeModule.toUpperCase()} />
                    )}
                    {/* X-10: aviso de conexión Socket.IO perdida */}
                    {socketStatus === 'disconnected' && (
                        <Alert
                            color="orange"
                            icon={<IconWifiOff size={16} />}
                            radius={0}
                            p="xs"
                            styles={{ root: { borderBottom: '1px solid var(--mantine-color-orange-3)' } }}
                        >
                            <Text size="xs">
                                Sin conexión en tiempo real — intentando reconectar. Las notificaciones nuevas pueden tardar en llegar.
                            </Text>
                        </Alert>
                    )}
                    <Box 
                        ref={viewportRef}
                        style={{ 
                            flex: 1, 
                            display: 'flex', 
                            flexDirection: 'column', 
                            minHeight: 0,
                            overflowY: isFullHeightModule ? 'hidden' : 'auto'
                        }} 
                        p={isFullHeightModule ? 0 : { base: 'xs', md: 'md' }} 
                        pb={0}
                    >
                        {children}
                    </Box>
                    <ScrollButtons viewportRef={viewportRef} />

                    <HelpCenter opened={helpCenterOpen} onClose={() => setHelpCenterOpen(false)} />
                </Box>
            </AppShell.Main>
        </AppShell>
    );
};
