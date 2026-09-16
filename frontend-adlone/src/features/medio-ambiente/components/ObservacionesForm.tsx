import React, { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Textarea } from '../../../components/ui/textarea';
import { cn } from '../../../lib/utils';

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
        <div className="w-full rounded-xl border border-border p-6 box-border">
            <div className="flex flex-col gap-3">
                <div>
                    <span className="mb-2 block text-[13px] font-semibold">{label}</span>
                    <Textarea
                        placeholder={placeholder}
                        value={text}
                        onChange={handleChange}
                        readOnly={readOnly}
                        rows={6}
                        className={cn(atLimit && 'border-destructive focus-visible:ring-destructive')}
                    />
                    {!readOnly && (
                        <p className={cn('mt-1 text-right text-[11px]', atLimit ? 'text-destructive' : 'text-muted-foreground')}>
                            {atLimit ? 'Límite de caracteres alcanzado' : `${text.length} / 250 caracteres`}
                        </p>
                    )}
                </div>

                {children && (
                    <div className="border-t border-border pt-4">
                        <div className="flex justify-end gap-3">
                            {children}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export const ObservacionesForm = React.memo(ObservacionesFormComponent);
