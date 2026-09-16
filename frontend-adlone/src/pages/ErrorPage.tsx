import React from 'react';
import { IconAlertCircle, IconHome } from '@tabler/icons-react';
import '../features/auth/Login.css'; // Reuse login styles for background
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
            <div className="login-container mx-auto max-w-[420px]">
                <Card className="shadcn-scope login-card rounded-[20px] p-6">
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                            <IconAlertCircle size={48} />
                        </div>

                        <div className="relative text-center">
                            <span className="absolute left-1/2 top-[10%] z-0 -translate-x-1/2 text-[64px] font-bold leading-none text-foreground/10">
                                {code}
                            </span>
                            <h2 className="relative z-10 m-0 text-2xl font-bold text-foreground">{title}</h2>
                            <p className="relative z-10 mt-2 text-[13px] text-muted-foreground">
                                {message}
                            </p>
                        </div>

                        <div className="mt-6 flex w-full justify-center">
                            <Button size="lg" className="w-full" onClick={handleBackToHome}>
                                <IconHome size={18} />
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
