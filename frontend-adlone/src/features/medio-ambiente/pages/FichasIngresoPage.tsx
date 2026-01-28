import React, { useState } from 'react';
import { SelectionCard } from '../components/SelectionCard';
import '../styles/FichasIngreso.css';

// Aquí importamos las sub-páginas para renderizarlas cuando se selecciona una tarjeta
// (Por ahora usaré placeholders o componentes simples dentro de este mismo archivo 
// si el usuario quiere mantenerlo separado, lo moveré. Pero dado su aviso de ficheros <1000 lineas,
// es mejor modularizar)

import { ComercialPage } from './ComercialPage';
import { TecnicaPage } from './TecnicaPage';
import { CoordinacionPage } from './CoordinacionPage';

import { ProtectedContent } from '../../../components/auth/ProtectedContent';

export const FichasIngresoPage = () => {
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    // Enforce permission even if state was somehow set (extra safety, though UI hiding is primary)
    // Actually, ProtectedContent handles the view, but if we want to prevent rendering the page component:
    // We can rely on the buttons being hidden.

    if (selectedOption === 'comercial') {
        return (
            <ProtectedContent permission="MA_COMERCIAL_ACCESO" fallback={<div>No tiene permisos</div>}>
                <ComercialPage onBack={() => setSelectedOption(null)} />
            </ProtectedContent>
        );
    }
    if (selectedOption === 'tecnica') {
        return (
            <ProtectedContent permission="MA_TECNICA_ACCESO" fallback={<div>No tiene permisos</div>}>
                <TecnicaPage onBack={() => setSelectedOption(null)} />
            </ProtectedContent>
        );
    }
    if (selectedOption === 'coordinacion') {
        return (
            <ProtectedContent permission="MA_COORDINACION_ACCESO" fallback={<div>No tiene permisos</div>}>
                <CoordinacionPage onBack={() => setSelectedOption(null)} />
            </ProtectedContent>
        );
    }

    return (
        <div className="fichas-ingreso-container">
            <header className="page-header">
                <h1 className="page-title-geo">Fichas de Ingreso - Medio Ambiente</h1>
                <p className="page-subtitle">Seleccione el área de trabajo para comenzar</p>
            </header>

            <div className="cards-grid">
                <ProtectedContent permission="MA_COMERCIAL_ACCESO">
                    <SelectionCard
                        title="Comercial"
                        description="Gestión de cotizaciones, clientes y oportunidades comerciales para medio ambiente."
                        icon="💼"
                        color="#1565c0" // Azul ADL
                        onClick={() => setSelectedOption('comercial')}
                    />
                </ProtectedContent>

                <ProtectedContent permission="MA_TECNICA_ACCESO">
                    <SelectionCard
                        title="Área Técnica"
                        description="Ingreso de muestras técnicas, control de parámetros y gestión de análisis de laboratorio."
                        icon="🧪"
                        color="#2e7d32" // Verde Técnico
                        onClick={() => setSelectedOption('tecnica')}
                    />
                </ProtectedContent>

                <ProtectedContent permission="MA_COORDINACION_ACCESO">
                    <SelectionCard
                        title="Coordinación"
                        description="Planificación de muestreos, logística de retiro y coordinación de personal en terreno."
                        icon="📅"
                        color="#f57c00" // Naranja ADL
                        onClick={() => setSelectedOption('coordinacion')}
                    />
                </ProtectedContent>
            </div>
        </div>
    );
};
