import React from 'react';
import { Container, Title, Text, Button, Group, Box, Card, ThemeIcon, rem, Stack } from '@mantine/core';
import { IconAlertCircle, IconHome } from '@tabler/icons-react';
import '../features/auth/Login.css'; // Reuse login styles for background

interface ErrorPageProps {
    code?: string | number;
    title?: string;
    message?: string;
    resetError?: () => void;
}

export const ErrorPage: React.FC<ErrorPageProps> = ({ 
    code = '500', 
    title = 'Algo salió mal', 
    message = 'Ha ocurrido un error inesperado en la aplicación.',
    resetError 
}) => {
    const handleBackToHome = () => {
        if (resetError) {
            resetError();
        }
        window.location.href = '/';
    };

    return (
        <div className="login-page">
            <Container size={420} className="login-container">
                <Card className="login-card" radius="xl" shadow="xl" p="xl">
                    <Stack align="center" gap="md">
                        <ThemeIcon 
                            variant="light" 
                            color="red" 
                            size={80} 
                            radius={80}
                        >
                            <IconAlertCircle size={rem(48)} />
                        </ThemeIcon>

                        <Box style={{ textAlign: 'center' }}>
                            <Text 
                                fw={900} 
                                style={{ 
                                    fontSize: rem(64), 
                                    lineHeight: 1, 
                                    opacity: 0.1,
                                    position: 'absolute',
                                    top: '10%',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    zIndex: 0
                                }}
                            >
                                {code}
                            </Text>
                            <Title order={2} style={{ position: 'relative', zIndex: 1 }}>{title}</Title>
                            <Text c="dimmed" size="sm" mt="sm" style={{ position: 'relative', zIndex: 1 }}>
                                {message}
                            </Text>
                        </Box>

                        <Group justify="center" mt="xl" style={{ width: '100%' }}>
                            <Button 
                                variant="light" 
                                color="adl-blue" 
                                size="md" 
                                radius="md"
                                leftSection={<IconHome size={18} />}
                                onClick={handleBackToHome}
                                fullWidth
                            >
                                Regresar al Inicio
                            </Button>
                        </Group>
                    </Stack>
                </Card>
            </Container>
        </div>
    );
};

export default ErrorPage;
