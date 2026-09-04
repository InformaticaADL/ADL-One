import { useCallback, useState } from 'react';
import { Modal } from 'antd';

export interface ConfirmOpts {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
}

// Hook de confirmación basado en antd Modal. Devuelve `ask(opts)` para pedir
// confirmación y un `dialog` que se renderiza una sola vez en el árbol.
export function useConfirm() {
    const [opts, setOpts] = useState<ConfirmOpts | null>(null);
    const ask = useCallback((o: ConfirmOpts) => setOpts(o), []);

    const dialog = (
        <Modal
            open={!!opts}
            title={opts?.title}
            onCancel={() => setOpts(null)}
            onOk={() => { opts?.onConfirm(); setOpts(null); }}
            okText={opts?.confirmLabel || 'Confirmar'}
            cancelText="Cancelar"
            okButtonProps={{ danger: opts?.danger }}>
            {opts?.message}
        </Modal>
    );

    return { ask, dialog };
}
