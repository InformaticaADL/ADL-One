import React from 'react';
import { 
    Textarea, 
    Paper, 
    Stack, 
    Box 
} from '@mantine/core';

interface ObservacionesFormProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    readOnly?: boolean;
    placeholder?: string;
    children?: React.ReactNode;
}

const ObservacionesFormComponent: React.FC<ObservacionesFormProps> = ({
    value,
    onChange,
    label = "Observaciones *",
    readOnly = false,
    placeholder = "Ingrese observaciones...",
    children
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        if (newValue.length <= 250) {
            onChange(newValue);
        }
    };

    return (
        <Paper withBorder p="xl" radius="md" shadow="sm" style={{ width: '100%' }}>
            <Stack gap="md">
                <Textarea
                    label={label}
                    placeholder={placeholder}
                    value={value}
                    onChange={handleChange}
                    readOnly={readOnly}
                    minRows={6}
                    autosize
                    radius="md"
                    size="md"
                    description={!readOnly ? `${value.length} / 250 caracteres` : undefined}
                    error={!readOnly && value.length >= 250 ? 'Límite de caracteres alcanzado' : undefined}
                    styles={{
                        label: { fontWeight: 600, marginBottom: 8 },
                        description: { textAlign: 'right', marginTop: 4 }
                    }}
                />

                {children && (
                    <Box pt="lg" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                        <Stack align="flex-end" gap="md">
                            <Box style={{ display: 'flex', gap: 'var(--mantine-spacing-md)' }}>
                                {children}
                            </Box>
                        </Stack>
                    </Box>
                )}
            </Stack>
        </Paper>
    );
};

export const ObservacionesForm = React.memo(ObservacionesFormComponent);
