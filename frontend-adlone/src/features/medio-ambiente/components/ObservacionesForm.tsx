import React, { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { 
    Textarea, 
    Paper, 
    Stack, 
    Box 
} from '@mantine/core';

export interface ObservacionesFormHandle {
    getData: () => string;
}

interface ObservacionesFormProps {
    initialValue?: string;
    onValidationChange?: (isValid: boolean) => void;
    label?: string;
    readOnly?: boolean;
    placeholder?: string;
    children?: React.ReactNode;
}

const ObservacionesFormComponent = forwardRef<ObservacionesFormHandle, ObservacionesFormProps>(({
    initialValue = '',
    onValidationChange,
    label = "Instrucciones comerciales *",
    readOnly = false,
    placeholder = "Ingrese observaciones...",
    children
}, ref) => {
    const [text, setText] = useState(initialValue);
    const lastValidRef = React.useRef(initialValue.trim().length > 0);

    useImperativeHandle(ref, () => ({
        getData: () => text
    }));

    // Sincronización inicial
    useEffect(() => {
        if (onValidationChange) {
            onValidationChange(lastValidRef.current);
        }
    }, [onValidationChange]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        if (newValue.length <= 250) {
            setText(newValue);
            
            const isNowValid = newValue.trim().length > 0;
            if (isNowValid !== lastValidRef.current) {
                lastValidRef.current = isNowValid;
                if (onValidationChange) {
                    onValidationChange(isNowValid);
                }
            }
        }
    };

    return (
        <Paper withBorder p="xl" radius="md" shadow="sm" style={{ width: '100%' }}>
            <Stack gap="md">
                <Textarea
                    label={label}
                    placeholder={placeholder}
                    value={text}
                    onChange={handleChange}
                    readOnly={readOnly}
                    minRows={6}
                    autosize
                    radius="md"
                    size="md"
                    description={!readOnly ? `${text.length} / 250 caracteres` : undefined}
                    error={!readOnly && text.length >= 250 ? 'Límite de caracteres alcanzado' : undefined}
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
});

export const ObservacionesForm = React.memo(ObservacionesFormComponent);
