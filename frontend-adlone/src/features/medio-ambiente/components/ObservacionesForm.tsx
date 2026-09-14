import React, { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Input, Typography } from 'antd';

const { TextArea } = Input;
const { Text } = Typography;

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
    const safeInitial = initialValue || '';
    const [text, setText] = useState(safeInitial);
    const lastValidRef = React.useRef(safeInitial.trim().length > 0);

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

    const atLimit = !readOnly && text.length >= 250;

    return (
        <div style={{ border: '1px solid var(--app-border)', borderRadius: 12, padding: 24, width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                    <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>{label}</Text>
                    <TextArea
                        placeholder={placeholder}
                        value={text}
                        onChange={handleChange}
                        readOnly={readOnly}
                        autoSize={{ minRows: 6 }}
                        status={atLimit ? 'error' : undefined}
                    />
                    {!readOnly && (
                        <Text
                            type={atLimit ? 'danger' : 'secondary'}
                            style={{ fontSize: 11, display: 'block', textAlign: 'right', marginTop: 4 }}
                        >
                            {atLimit ? 'Límite de caracteres alcanzado' : `${text.length} / 250 caracteres`}
                        </Text>
                    )}
                </div>

                {children && (
                    <div style={{ paddingTop: 16, borderTop: '1px solid var(--app-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            {children}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export const ObservacionesForm = React.memo(ObservacionesFormComponent);
