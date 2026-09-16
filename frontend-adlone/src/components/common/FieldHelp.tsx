/**
 * FieldHelp — componente de ayuda contextual para campos de formulario.
 *
 * Uso:
 *   <Select label={<FieldLabel label="Empresa *" help="Empresa que presta el servicio de muestreo." />} ... />
 *   <TextInput label={<FieldLabel label="Punto de Muestreo *" help="Nombre o código del punto exacto donde se tomará la muestra." />} ... />
 */

import { IconInfoCircle } from '@tabler/icons-react';

interface FieldLabelProps {
    /** Texto del label (puede incluir el asterisco de obligatorio) */
    label: React.ReactNode;
    /** Descripción que aparece al pasar el cursor o presionar el botón */
    help: string;
}

export const FieldLabel = ({ label, help }: FieldLabelProps) => (
    <span className="inline-flex flex-nowrap items-center gap-1">
        <span className="text-sm font-medium">{label}</span>
        <span
            title={help}
            className="inline-flex h-4 w-4 min-w-4 shrink-0 cursor-help items-center justify-center rounded-full bg-muted-foreground text-background"
        >
            <IconInfoCircle size={11} stroke={2.5} />
        </span>
    </span>
);
