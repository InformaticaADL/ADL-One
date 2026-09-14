/**
 * FieldHelp — componente de ayuda contextual para campos de formulario.
 *
 * Uso:
 *   <Select label={<FieldLabel label="Empresa *" help="Empresa que presta el servicio de muestreo." />} ... />
 *   <TextInput label={<FieldLabel label="Punto de Muestreo *" help="Nombre o código del punto exacto donde se tomará la muestra." />} ... />
 */

import { Tooltip } from 'antd';
import { IconInfoCircle } from '@tabler/icons-react';

interface FieldLabelProps {
    /** Texto del label (puede incluir el asterisco de obligatorio) */
    label: React.ReactNode;
    /** Descripción que aparece al pasar el cursor o presionar el botón */
    help: string;
}

export const FieldLabel = ({ label, help }: FieldLabelProps) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
        <Tooltip
            title={help}
            placement="topLeft"
            overlayInnerStyle={{ fontSize: 12, lineHeight: 1.5, padding: '8px 12px', maxWidth: 260 }}
        >
            <span
                style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 16, height: 16, minWidth: 16, borderRadius: '50%',
                    backgroundColor: '#adb5bd', color: '#fff', cursor: 'help', flexShrink: 0,
                }}
            >
                <IconInfoCircle size={11} stroke={2.5} />
            </span>
        </Tooltip>
    </span>
);
