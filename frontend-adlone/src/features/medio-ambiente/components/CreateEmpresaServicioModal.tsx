import React, { useState } from 'react';
import { 
    Modal, 
    TextInput, 
    Button, 
    Stack, 
    Group, 
    Text, 
    ThemeIcon,
    SimpleGrid
} from '@mantine/core';
import { IconBuilding, IconCheck, IconX, IconMail, IconUser } from '@tabler/icons-react';
import { catalogosService } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';

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
            opened={opened}
            onClose={handleClose}
            title={
                <Group gap="xs">
                    <ThemeIcon size="lg" radius="md" color="teal">
                        <IconBuilding size={20} />
                    </ThemeIcon>
                    <Text size="xl" fw={800} c="teal.9">
                        Nueva Empresa de Servicio
                    </Text>
                </Group>
            }
            size="lg"
            radius="lg"
            centered
        >
            <form onSubmit={handleSubmit}>
                <Stack gap="md">
                    <Text size="sm" c="dimmed">
                        Ingrese los datos básicos de la nueva empresa prestadora de servicios de muestreo.
                    </Text>

                    <TextInput
                        label="Nombre de la Empresa"
                        placeholder="Ej: ADL Servicios Ambientales"
                        required
                        value={formData.nombre_empresaservicios}
                        onChange={(e) => setFormData({ ...formData, nombre_empresaservicios: e.target.value })}
                        leftSection={<IconBuilding size={16} />}
                        radius="md"
                    />

                    <SimpleGrid cols={2}>
                        <TextInput
                            label="Contacto Principal"
                            placeholder="Nombre del contacto"
                            value={formData.contacto_empresaservicios}
                            onChange={(e) => setFormData({ ...formData, contacto_empresaservicios: e.target.value })}
                            leftSection={<IconUser size={16} />}
                            radius="md"
                        />
                        <TextInput
                            label="Email Contacto"
                            placeholder="contacto@empresa.cl"
                            type="email"
                            value={formData.email_contacto}
                            onChange={(e) => setFormData({ ...formData, email_contacto: e.target.value })}
                            leftSection={<IconMail size={16} />}
                            radius="md"
                        />
                    </SimpleGrid>

                    <TextInput
                        label="Email Institucional (Facturación/Reportes)"
                        placeholder="operaciones@empresa.cl"
                        type="email"
                        value={formData.email_empresaservicios}
                        onChange={(e) => setFormData({ ...formData, email_empresaservicios: e.target.value })}
                        leftSection={<IconMail size={16} />}
                        radius="md"
                    />

                    <Group justify="flex-end" mt="xl">
                        <Button variant="subtle" color="gray" onClick={handleClose} leftSection={<IconX size={16} />}>
                            Cancelar
                        </Button>
                        <Button 
                            type="submit" 
                            color="teal" 
                            loading={loading}
                            leftSection={<IconCheck size={16} />}
                        >
                            Crear Empresa
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
};
