import { useEffect, useRef } from 'react';
import { AppShell, Box, Burger, Group, Image } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { useNavStore } from '../../store/navStore';
import { Sidebar } from './Sidebar';

import logoAdl from '../../assets/images/logo-adlone.png';
import { useNotificationStore } from '../../store/notificationStore';
import { useAuth } from '../../contexts/AuthContext';
import ContextualNotificationPanel from '../../features/notifications/components/ContextualNotificationPanel';
import { ScrollButtons } from '../common/ScrollButtons';

interface MainLayoutProps {
    children?: React.ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
    const isCompact = useMediaQuery('(max-width: 1200px)');
    const { 
        activeModule, 
        activeSubmodule,
        sidebarCollapsed,
        resetNavigation
    } = useNavStore();
    const [opened, { toggle, close }] = useDisclosure();
    const viewportRef = useRef<HTMLDivElement>(null);

    // Auto-close sidebar on compact view when navigating (only on terminal submodule selection)
    useEffect(() => {
        if (isCompact && activeSubmodule) {
            close();
        }
    }, [activeSubmodule, isCompact, close]);

    // Global Notifications listener (Toast logic)
    const { user } = useAuth();
    const { fetchNotifications, initSocket, disconnectSocket } = useNotificationStore();

    // Socket Initialization
    useEffect(() => {
        if (user?.id) {
            initSocket(user.id);
            fetchNotifications(); // Initial fetch
        }

        return () => {
            disconnectSocket();
        };
    }, [user?.id, initSocket, disconnectSocket, fetchNotifications]);



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
                    backgroundColor: '#f4f4f5',
                    transition: 'padding-left 300ms ease',
                    display: 'flex',
                    flexDirection: 'column',
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
                    />
                </Box>
            </AppShell.Navbar>

            <AppShell.Main>
                <Box style={{ 
                    position: 'relative', 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column',
                    height: '100%',
                    overflow: 'hidden' 
                }}>
                    {activeModule && (
                        <ContextualNotificationPanel area={activeModule.toUpperCase()} />
                    )}
                    <Box 
                        ref={viewportRef}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }} 
                        p={{ base: 'xs', md: 'md' }} 
                        pb={0}
                    >
                        {children}
                    </Box>
                    <ScrollButtons viewportRef={viewportRef} />
                </Box>
            </AppShell.Main>
        </AppShell>
    );
};
