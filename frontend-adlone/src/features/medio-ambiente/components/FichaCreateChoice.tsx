import React from 'react';
import {
    Stack,
    SimpleGrid,
    Paper,
    Title,
    Text,
    Group,
    ThemeIcon,
    Box,
    Container,
    Badge
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
    IconFileText,
    IconUpload,
    IconArrowRight,
    IconChevronLeft
} from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';

interface Props {
    onManual: () => void;
    onBulk: () => void;
    onBack: () => void;
}

export const FichaCreateChoice: React.FC<Props> = ({ onManual, onBulk, onBack }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');

    return (
        <Container fluid w="100%" px={0} py="md">
            <Stack gap="xl">
                <PageHeader title="Nueva Ficha de Ingreso" onBack={onBack} />

                <Paper withBorder p={isMobile ? 'xl' : 60} radius="lg" shadow="sm">
                    <Stack gap="xl" align="center">
                        <Box ta="center">
                            <Title order={2} fw={800} c="blue.8">
                                ¿Cómo desea crear la ficha?
                            </Title>
                            <Text size="md" c="dimmed" mt="xs" maw={500} mx="auto">
                                Seleccione el método de ingreso. Puede crear una ficha manualmente o cargar múltiples fichas desde archivos PDF o Excel.
                            </Text>
                        </Box>

                        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl" w="100%" maw={800} mx="auto" mt="lg">
                            {/* Manual Creation Card */}
                            <Paper
                                withBorder
                                p="xl"
                                radius="lg"
                                shadow="sm"
                                onClick={onManual}
                                style={{
                                    cursor: 'pointer',
                                    transition: 'all 0.25s ease',
                                    border: '2px solid transparent',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--mantine-color-blue-4)';
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(34,139,230,0.15)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'transparent';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '';
                                }}
                            >
                                <Stack gap="md" align="center" ta="center">
                                    <ThemeIcon size={70} radius="xl" variant="light" color="blue">
                                        <IconFileText size={36} />
                                    </ThemeIcon>

                                    <Box>
                                        <Text fw={700} size="lg">Creación Manual</Text>
                                        <Text size="sm" c="dimmed" mt={4}>
                                            Formulario paso a paso para ingresar antecedentes, análisis y observaciones de una sola ficha.
                                        </Text>
                                    </Box>

                                    <Group gap={4} c="blue.6">
                                        <Text size="sm" fw={600}>Iniciar formulario</Text>
                                        <IconArrowRight size={16} />
                                    </Group>
                                </Stack>
                            </Paper>

                            {/* Bulk PDF Card */}
                            <Paper
                                withBorder
                                p="xl"
                                radius="lg"
                                shadow="sm"
                                onClick={onBulk}
                                style={{
                                    cursor: 'pointer',
                                    transition: 'all 0.25s ease',
                                    border: '2px solid transparent',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--mantine-color-grape-4)';
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(190,75,219,0.15)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'transparent';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '';
                                }}
                            >
                                <Badge
                                    size="sm"
                                    variant="filled"
                                    color="grape"
                                    style={{ position: 'absolute', top: 12, right: 12 }}
                                >
                                    MASIVO
                                </Badge>

                                <Stack gap="md" align="center" ta="center">
                                    <ThemeIcon size={70} radius="xl" variant="light" color="grape">
                                        <IconUpload size={36} />
                                    </ThemeIcon>

                                    <Box>
                                        <Text fw={700} size="lg">Carga Masiva (PDF / Excel)</Text>
                                        <Text size="sm" c="dimmed" mt={4}>
                                            Suba hasta 1000 archivos (PDF o Excel). El sistema extraerá los datos, los validará y creará las fichas automáticamente.
                                        </Text>
                                    </Box>

                                    <Group gap={4} c="grape.6">
                                        <Text size="sm" fw={600}>Cargar archivos</Text>
                                        <IconArrowRight size={16} />
                                    </Group>
                                </Stack>
                            </Paper>
                        </SimpleGrid>
                    </Stack>
                </Paper>
            </Stack>
        </Container>
    );
};
