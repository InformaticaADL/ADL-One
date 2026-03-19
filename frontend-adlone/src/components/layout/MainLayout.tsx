import { useEffect } from 'react';
import { AppShell, Box } from '@mantine/core';
import { useNavStore } from '../../store/navStore';
import { Sidebar } from './Sidebar';
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
            navbar={{
                width: sidebarCollapsed ? 80 : 300,
                breakpoint: 'sm',
            }}
            padding="md"
            styles={{
                main: {
                    backgroundColor: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))',
                    transition: 'padding-left 300ms ease',
                    minHeight: '100vh',
                }
            }}
        >
            <AppShell.Navbar>
                <Sidebar />
            </AppShell.Navbar>

            <AppShell.Main>
                <Box style={{ position: 'relative' }}>
                    {activeModule && (
                        <ContextualNotificationPanel area={activeModule.toUpperCase()} />
                    )}
                    {children}
                </Box>
            </AppShell.Main>
        </AppShell>
    );
};
