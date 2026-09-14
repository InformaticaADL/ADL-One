import React from 'react';
import { Typography, Button, Card } from 'antd';
import { IconAlertCircle, IconHome } from '@tabler/icons-react';
import '../features/auth/Login.css'; // Reuse login styles for background

const { Title, Text } = Typography;

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
            <div className="login-container" style={{ maxWidth: 420, margin: '0 auto' }}>
                <Card className="login-card" style={{ borderRadius: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <div style={{
                            width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(224,49,49,0.12)', color: '#e03131',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <IconAlertCircle size={48} />
                        </div>

                        <div style={{ textAlign: 'center', position: 'relative' }}>
                            <Text
                                strong
                                style={{
                                    fontSize: 64,
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
                            <Title level={2} style={{ position: 'relative', zIndex: 1, margin: 0 }}>{title}</Title>
                            <Text type="secondary" style={{ fontSize: 13, position: 'relative', zIndex: 1, display: 'block', marginTop: 8 }}>
                                {message}
                            </Text>
                        </div>

                        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 24 }}>
                            <Button
                                block
                                size="large"
                                icon={<IconHome size={18} />}
                                onClick={handleBackToHome}
                            >
                                Regresar al Inicio
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default ErrorPage;
