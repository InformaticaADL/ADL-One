import React from 'react';
import { IconTicket, IconHeadset, IconArrowRight } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { useNavStore } from '../store/navStore';
import fondoLogin from '../assets/images/fondo-login.png';

export const WelcomePage: React.FC = () => {
    const { setActiveModule, setActiveSubmodule } = useNavStore();

    const goToFullInbox = () => {
        setActiveModule('solicitudes');
        setActiveSubmodule('');
    };

    const goToNewRequest = () => {
        setActiveModule('solicitudes');
        setActiveSubmodule('urs-new-request');
    };

    return (
        <div className="shadcn-scope flex w-full max-w-full flex-col">

            {/* ===== BANNER ===== */}
            <div
                className="relative flex min-h-[320px] items-center justify-center overflow-hidden"
                style={{ backgroundImage: `url(${fondoLogin})`, backgroundSize: 'cover', backgroundPosition: 'center 40%' }}
            >
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
                <div className="relative z-10 flex flex-col items-center gap-1 px-6 text-center">
                    <p className="text-[13px] font-bold uppercase tracking-widest text-white/60">ADL DIAGNOSTIC · SISTEMA INTERNO</p>
                    <h1 className="m-0 text-4xl font-black leading-tight tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.6)]">
                        Bienvenido al Portal ADL One
                    </h1>
                </div>
            </div>

            {/* ===== MESA DE AYUDA ===== */}
            <div className="flex flex-1 flex-col items-center gap-8 px-6 py-10">

                {/* Header centrado */}
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <IconHeadset size={26} />
                    </div>
                    <div>
                        <h2 className="m-0 text-xl font-black tracking-tight text-foreground">Solicitudes ADL</h2>
                        <p className="text-[13px] text-muted-foreground">Seleccioná el tipo de solicitud para comenzar</p>
                    </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-col items-center gap-2">
                    <Button size="lg" onClick={goToNewRequest} className="gap-2 px-8">
                        <IconTicket size={17} />
                        Realizar solicitudes
                    </Button>
                    <button
                        onClick={goToFullInbox}
                        className="flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-primary"
                    >
                        Ver todas mis solicitudes <IconArrowRight size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
};
