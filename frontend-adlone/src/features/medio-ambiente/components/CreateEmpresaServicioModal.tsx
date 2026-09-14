import React, { useState } from 'react';
import { Modal, Input, Button, Typography } from 'antd';
import { IconBuilding, IconCheck, IconX, IconMail, IconUser } from '@tabler/icons-react';
import { catalogosService } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';

const { Text } = Typography;

interface CreateEmpresaServicioModalProps {
    opened: boolean;
    onClose: () => void;
    onCreated: (newId: string) => void;
}

export const CreateEmpresaServicioModal: React.FC<CreateEmpresaServicioModalProps> = ({
    opened,
    onClose,
    onCreated
}) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nombre_empresaservicios: '',
        contacto_empresaservicios: '',
        email_contacto: '',
        email_empresaservicios: '',
        habilitado: 'S'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nombre_empresaservicios.trim()) {
            showToast({ type: 'error', message: 'El nombre de la empresa es obligatorio' });
            return;
        }

        setLoading(true);
        try {
            // Usamos el servicio genérico de maestros para crear
            const result = await catalogosService.createMaestro('mae_empresaservicios', formData);

            if (result.success) {
                showToast({ type: 'success', message: 'Empresa de servicio creada correctamente' });

                // Intentamos recuperar el ID de la empresa recién creada.
                // Como createMaestro genérico no devuelve el ID, tendremos que confiar en que
                // el componente padre refrescará la lista y buscará por nombre o simplemente refrescará.
                // En un sistema ideal, el backend devolvería el INSERTED.id.
                onCreated('');
                handleClose();
            }
        } catch (error: any) {
            console.error('Error creating empresa:', error);
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al crear la empresa' });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({
            nombre_empresaservicios: '',
            contacto_empresaservicios: '',
            email_contacto: '',
            email_empresaservicios: '',
            habilitado: 'S'
        });
        onClose();
    };

    return (
        <Modal
            open={opened}
            onCancel={handleClose}
            footer={null}
            width={600}
            centered
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(9,143,131,0.12)',
                        color: '#098f83', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <IconBuilding size={20} />
                    </div>
                    <Text style={{ fontSize: 18, fontWeight: 800, color: '#0b7285' }}>
                        Nueva Empresa de Servicio
                    </Text>
                </div>
            }
        >
            <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                        Ingrese los datos básicos de la nueva empresa prestadora de servicios de muestreo.
                    </Text>

                    <Field label="Nombre de la Empresa *">
                        <Input
                            placeholder="Ej: ADL Servicios Ambientales"
                            required
                            value={formData.nombre_empresaservicios}
                            onChange={(e) => setFormData({ ...formData, nombre_empresaservicios: e.target.value })}
                            prefix={<IconBuilding size={16} style={{ color: 'var(--app-text-secondary)' }} />}
                        />
                    </Field>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <Field label="Contacto Principal">
                            <Input
                                placeholder="Nombre del contacto"
                                value={formData.contacto_empresaservicios}
                                onChange={(e) => setFormData({ ...formData, contacto_empresaservicios: e.target.value })}
                                prefix={<IconUser size={16} style={{ color: 'var(--app-text-secondary)' }} />}
                            />
                        </Field>
                        <Field label="Email Contacto">
                            <Input
                                placeholder="contacto@empresa.cl"
                                type="email"
                                value={formData.email_contacto}
                                onChange={(e) => setFormData({ ...formData, email_contacto: e.target.value })}
                                prefix={<IconMail size={16} style={{ color: 'var(--app-text-secondary)' }} />}
                            />
                        </Field>
                    </div>

                    <Field label="Email Institucional (Facturación/Reportes)">
                        <Input
                            placeholder="operaciones@empresa.cl"
                            type="email"
                            value={formData.email_empresaservicios}
                            onChange={(e) => setFormData({ ...formData, email_empresaservicios: e.target.value })}
                            prefix={<IconMail size={16} style={{ color: 'var(--app-text-secondary)' }} />}
                        />
                    </Field>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
                        <Button onClick={handleClose} icon={<IconX size={16} />}>
                            Cancelar
                        </Button>
                        <Button
                            htmlType="submit"
                            type="primary"
                            style={{ backgroundColor: '#0b7285' }}
                            loading={loading}
                            icon={<IconCheck size={16} />}
                        >
                            Crear Empresa
                        </Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
        </div>
    );
}
