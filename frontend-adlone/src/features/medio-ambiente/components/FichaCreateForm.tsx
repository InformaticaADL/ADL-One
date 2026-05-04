import React, { useState, useRef, useTransition, useCallback } from 'react';
import { AntecedentesForm } from './AntecedentesForm';
import type { AntecedentesFormHandle } from './AntecedentesForm';
import { AnalysisForm } from './AnalysisForm';
import { ObservacionesForm } from './ObservacionesForm';
import type { ObservacionesFormHandle } from './ObservacionesForm';
import { fichaService } from '../services/ficha.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';

import { 
    Modal, 
    Button, 
    Text, 
    Title, 
    Stack, 
    Group, 
    ThemeIcon, 
    Paper, 
    Divider,
    Box,
    Tabs,
    Container
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
    IconCheck,
    IconChevronLeft,
    IconPlus,
    IconFileText,
    IconArrowRight,
    IconTable,
    IconEdit,
    IconEye
} from '@tabler/icons-react';
import { useNavStore } from '../../../store/navStore';

const SuccessModal = ({
    isOpen,
    onClose,
    onViewFicha,
    fichaId
}: {
    isOpen: boolean;
    onClose: () => void;
    onViewFicha: () => void;
    fichaId: number | null
}) => {
    return (
        <Modal
            opened={isOpen}
            onClose={onClose}
            title="¡Ficha Creada Exitosamente!"
            centered
            size="md"
            radius="lg"
            withCloseButton={false}
        >
            <Stack align="center" py="xl">
                <ThemeIcon size={80} radius="xl" color="green" variant="light">
                    <IconCheck size={40} />
                </ThemeIcon>

                <Title order={3} ta="center">Registro Confirmado</Title>

                <Text ta="center" c="dimmed">
                    Se ha generado la Ficha N° <Text span fw={700} c="blue">{fichaId}</Text> correctamente en el sistema.
                </Text>

                <Group w="100%" mt="lg">
                    <Button
                        flex={1}
                        size="md"
                        variant="light"
                        color="blue"
                        radius="md"
                        leftSection={<IconEye size={18} />}
                        onClick={onViewFicha}
                    >
                        Ver Ficha
                    </Button>
                    <Button
                        flex={1}
                        size="md"
                        color="green"
                        radius="md"
                        onClick={onClose}
                    >
                        Volver al Menú
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
};

export const FichaCreateForm = ({ onBackToMenu }: { onBackToMenu: () => void }) => {
    const isMobile = useMediaQuery('(max-width: 550px)');
    const isVerySmall = useMediaQuery('(max-width: 450px)');
    const { user } = useAuth();
    const { showToast } = useToast();
    const { setSelectedFicha, setFichasMode } = useNavStore();
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [createdFichaId, setCreatedFichaId] = useState<number | null>(null);
    const [isAntecedentesValid, setIsAntecedentesValid] = useState(false);
    const [isObservacionesValid, setIsObservacionesValid] = useState(false);
    const [, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState<string | null>('antecedentes');
    const antecedentesRef = useRef<AntecedentesFormHandle>(null);
    const observacionesRef = useRef<ObservacionesFormHandle>(null);
    const topRef = useRef<HTMLDivElement>(null);
    const [savedAnalysis, setSavedAnalysis] = useState<any[]>([]);

    const handleValidationChange = useCallback((isValid: boolean) => {
        startTransition(() => {
            setIsAntecedentesValid(isValid);
        });
    }, [startTransition]);

    const handleObsValidationChange = useCallback((isValid: boolean) => {
        startTransition(() => {
            setIsObservacionesValid(isValid);
        });
    }, [startTransition]);

    const scrollToTop = () => {
        if (topRef.current) {
            topRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
    };

    const handleSave = async () => {
        try {
            const antData = antecedentesRef.current?.getData ? antecedentesRef.current.getData() : null;
            if (!antData) {
                showToast({ type: 'warning', message: 'Por favor complete los antecedentes requeridos' });
                return;
            }

            const payload = {
                antecedentes: antData,
                analisis: savedAnalysis,
                observaciones: observacionesRef.current?.getData() || 'No Aplica',
                user: { id: user?.id || 0 }
            };

            const result = await fichaService.create(payload);

            if (result && (result.success || result.data?.success)) {
                const idToUse = result.data?.id || result.id;
                if (idToUse) {
                    setCreatedFichaId(Number(idToUse));
                    setShowSuccessModal(true);
                } else {
                    showToast({ type: 'warning', message: 'Ficha creada pero no se recibió un ID válido.' });
                }
            } else {
                showToast({ type: 'error', message: 'Error al respuesta del servidor' });
            }

        } catch (error: any) {
            console.error("Error saving ficha:", error);
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al grabar la ficha' });
        }
    };

    const handleCloseSuccess = () => {
        setShowSuccessModal(false);
        setCreatedFichaId(null);
        onBackToMenu();
    };

    const handleViewFicha = () => {
        if (createdFichaId) {
            setSelectedFicha(createdFichaId, null);
            setFichasMode('detail_ficha');
        }
        setShowSuccessModal(false);
    };

    return (
        <Container fluid w="100%" mx="auto" px={0} py="md" style={{ maxWidth: '100% !important' }}>
            <SuccessModal
                isOpen={showSuccessModal}
                onClose={handleCloseSuccess}
                onViewFicha={handleViewFicha}
                fichaId={createdFichaId}
            />

            <Stack gap="lg">
                <div ref={topRef} style={{ height: 0, overflow: 'hidden' }} />
                <PageHeader 
                    title="Nueva Ficha de Ingreso"
                    onBack={onBackToMenu}
                />

                <Paper withBorder p={0} radius="lg" shadow="sm" style={{ width: '100% !important', maxWidth: '100% !important', overflow: 'hidden' }}>
                    <Tabs 
                        value={activeTab} 
                        onChange={(val) => {
                            setActiveTab(val);
                            scrollToTop();
                        }} 
                        variant="outline" 
                        radius="md" 
                        style={{ width: '100% !important' }}
                    >
                        <Tabs.List grow style={{ borderBottom: '1px solid #dee2e6' }}>
                            <Tabs.Tab 
                                value="antecedentes" 
                                leftSection={<IconFileText size={isVerySmall ? 16 : (isMobile ? 18 : 22)} />}
                                px={isVerySmall ? 4 : (isMobile ? 'xs' : 'xl')} 
                                py={isMobile ? 'xs' : 'md'}
                                style={{ flex: '1 1 0%', fontSize: isVerySmall ? '0.75rem' : (isMobile ? '0.85rem' : '1rem'), fontWeight: 600, minWidth: 0 }}
                            >
                                {isVerySmall ? 'Antec.' : 'Antecedentes'}
                            </Tabs.Tab>
                            <Tabs.Tab 
                                value="analisis" 
                                leftSection={<IconTable size={isVerySmall ? 16 : (isMobile ? 18 : 22)} />}
                                px={isVerySmall ? 4 : (isMobile ? 'xs' : 'xl')} 
                                py={isMobile ? 'xs' : 'md'}
                                style={{ flex: '1 1 0%', fontSize: isVerySmall ? '0.75rem' : (isMobile ? '0.85rem' : '1rem'), fontWeight: 600, minWidth: 0 }}
                            >
                                Análisis
                            </Tabs.Tab>
                            <Tabs.Tab 
                                value="observaciones" 
                                leftSection={<IconEdit size={isVerySmall ? 16 : (isMobile ? 18 : 22)} />}
                                px={isVerySmall ? 4 : (isMobile ? 'xs' : 'xl')} 
                                py={isMobile ? 'xs' : 'md'}
                                style={{ flex: '1 1 0%', fontSize: isVerySmall ? '0.75rem' : (isMobile ? '0.85rem' : '1rem'), fontWeight: 600, minWidth: 0 }}
                            >
                                {isVerySmall ? 'Obs.' : 'Observaciones'}
                            </Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="antecedentes" p={isMobile ? 'md' : 50} pt="xl" style={{ width: '100% !important', minHeight: '70vh' }}>
                            <AntecedentesForm
                                ref={antecedentesRef}
                                onValidationChange={handleValidationChange}
                            />
                        </Tabs.Panel>

                        <Tabs.Panel value="analisis" p={isMobile ? 'md' : 50} pt="xl" style={{ width: '100% !important' }}>
                            <AnalysisForm
                                savedAnalysis={savedAnalysis}
                                onSavedAnalysisChange={setSavedAnalysis}
                            />
                        </Tabs.Panel>

                        <Tabs.Panel value="observaciones" p={isMobile ? 'md' : 50} pt="xl" style={{ width: '100% !important' }}>
                            <ObservacionesForm
                                ref={observacionesRef}
                                label="Instrucciones comerciales"
                                onValidationChange={handleObsValidationChange}
                            />
                        </Tabs.Panel>
                    </Tabs>

                    <Box px={isMobile ? 'md' : 50} pb={isMobile ? 'md' : 50}>
                        <Divider mb="xl" />
                        <Group justify="flex-end" gap="md">
                            {activeTab === 'antecedentes' && (
                                <Button
                                    size="md"
                                    rightSection={<IconArrowRight size={20} />}
                                    onClick={() => {
                                        setActiveTab('analisis');
                                        scrollToTop();
                                    }}
                                    disabled={!isAntecedentesValid}
                                >
                                    Siguiente
                                </Button>
                            )}

                            {activeTab === 'analisis' && (
                                <>
                                    <Button
                                        variant="outline"
                                        color="gray"
                                        size="md"
                                        leftSection={<IconChevronLeft size={20} />}
                                        onClick={() => setActiveTab('antecedentes')}
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        size="md"
                                        rightSection={<IconArrowRight size={20} />}
                                        onClick={() => {
                                            setActiveTab('observaciones');
                                            scrollToTop();
                                        }}
                                        disabled={savedAnalysis.length === 0}
                                    >
                                        Siguiente
                                    </Button>
                                </>
                            )}

                            {activeTab === 'observaciones' && (
                                <>
                                    <Button
                                        variant="outline"
                                        color="gray"
                                        size="md"
                                        leftSection={<IconChevronLeft size={20} />}
                                        onClick={() => setActiveTab('analisis')}
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        color="green"
                                        size="md"
                                        leftSection={<IconPlus size={20} />}
                                        onClick={handleSave}
                                        disabled={!isAntecedentesValid || savedAnalysis.length === 0 || !isObservacionesValid}
                                    >
                                        Grabar Ficha
                                    </Button>
                                </>
                            )}
                        </Group>
                    </Box>
                </Paper>
            </Stack>
        </Container>
    );
};
