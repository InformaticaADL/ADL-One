import { useEffect } from 'react';
import { AppShell, Box, Burger, Group, Text, Image } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useNavStore } from '../../store/navStore';
import { Sidebar } from './Sidebar';
import logoSmall from '../../assets/images/logo-adlone-pequeño.png';
import { useNotificationStore } from '../../store/notificationStore';
import { useAuth } from '../../contexts/AuthContext';
import ContextualNotificationPanel from '../../features/notifications/components/ContextualNotificationPanel';

interface MainLayoutProps {
    children?: React.ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
    const { 
        activeModule, 
        sidebarCollapsed 
    } = useNavStore();
    const [opened, { toggle, close }] = useDisclosure();

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

    // Close mobile navbar on submodule change
    const { activeSubmodule } = useNavStore();
    useEffect(() => {
        close();
    }, [activeSubmodule, close]);

    return (
        <AppShell
            header={{ height: { base: 60, md: 0 } }}
            navbar={{
                width: sidebarCollapsed ? 80 : 240,
                breakpoint: 'sm',
                collapsed: { mobile: !opened },
            }}
            h="100dvh"
            padding={0}
            styles={{
                main: {
                    backgroundColor: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))',
                    transition: 'padding-left 300ms ease',
                    height: 'calc(100vh - var(--app-shell-header-offset, 0px))',
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
        >
            <AppShell.Header px="md" hiddenFrom="sm">
                <Group h="100%" justify="space-between">
                    <Burger opened={opened} onClick={toggle} size="sm" />
                    <Group gap="xs">
                        <Image src={logoSmall} h={30} w={30} />
                        <Text fw={800} size="lg" c="adl-blue" lts="1px">ADL ONE</Text>
                    </Group>
                    <div style={{ width: 30 }} /> {/* Spacer to center the logo if needed */}
                </Group>
            </AppShell.Header>

            <AppShell.Navbar>
                <Box h="100%" pb="md">
                    <Sidebar />
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
                    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }} p={{ base: 'xs', md: 'md' }} pb={0}>
                        {children}
                    </Box>
                </Box>
            </AppShell.Main>
        </AppShell>
    );
};
