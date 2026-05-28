/**
 * FieldHelp — componente de ayuda contextual para campos de formulario.
 *
 * Uso:
 *   <Select label={<FieldLabel label="Empresa *" help="Empresa que presta el servicio de muestreo." />} ... />
 *   <TextInput label={<FieldLabel label="Punto de Muestreo *" help="Nombre o código del punto exacto donde se tomará la muestra." />} ... />
 */

import { Group, Text, Tooltip, ThemeIcon } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

interface FieldLabelProps {
    /** Texto del label (puede incluir el asterisco de obligatorio) */
    label: string;
    /** Descripción que aparece al pasar el cursor o presionar el botón */
    help: string;
}

export const FieldLabel = ({ label, help }: FieldLabelProps) => (
    <Group gap={4} wrap="nowrap" align="center" style={{ display: 'inline-flex' }}>
        <Text component="span" size="sm" fw={500}>{label}</Text>
        <Tooltip
            label={help}
            multiline
            w={260}
            withArrow
            position="top-start"
            color="dark"
            styles={{
                tooltip: {
                    fontSize: 12,
                    lineHeight: 1.5,
                    padding: '8px 12px',
                }
            }}
        >
            <ThemeIcon
                size={16}
                radius="xl"
                variant="filled"
                style={{
                    backgroundColor: '#adb5bd',
                    cursor: 'help',
                    flexShrink: 0,
                    minWidth: 16,
                }}
            >
                <IconInfoCircle size={11} stroke={2.5} />
            </ThemeIcon>
        </Tooltip>
    </Group>
);
