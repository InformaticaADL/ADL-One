import React, { useState } from 'react';
import { IconBuilding, IconCheck, IconX, IconMail, IconUser } from '@tabler/icons-react';
import { catalogosService } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';

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
        <Dialog open={opened} onOpenChange={(next) => { if (!next) handleClose(); }}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(9,143,131,0.12)] text-[#098f83]">
                            <IconBuilding size={20} />
                        </span>
                        <span className="text-lg font-extrabold text-[#0b7285]">Nueva Empresa de Servicio</span>
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="flex flex-col gap-4">
                        <p className="text-sm text-muted-foreground">
                            Ingrese los datos básicos de la nueva empresa prestadora de servicios de muestreo.
                        </p>

                        <Field label="Nombre de la Empresa *">
                            <div className="relative">
                                <IconBuilding size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Ej: ADL Servicios Ambientales"
                                    required
                                    value={formData.nombre_empresaservicios}
                                    onChange={(e) => setFormData({ ...formData, nombre_empresaservicios: e.target.value })}
                                    className="pl-8"
                                />
                            </div>
                        </Field>

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Contacto Principal">
                                <div className="relative">
                                    <IconUser size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Nombre del contacto"
                                        value={formData.contacto_empresaservicios}
                                        onChange={(e) => setFormData({ ...formData, contacto_empresaservicios: e.target.value })}
                                        className="pl-8"
                                    />
                                </div>
                            </Field>
                            <Field label="Email Contacto">
                                <div className="relative">
                                    <IconMail size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="contacto@empresa.cl"
                                        type="email"
                                        value={formData.email_contacto}
                                        onChange={(e) => setFormData({ ...formData, email_contacto: e.target.value })}
                                        className="pl-8"
                                    />
                                </div>
                            </Field>
                        </div>

                        <Field label="Email Institucional (Facturación/Reportes)">
                            <div className="relative">
                                <IconMail size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="operaciones@empresa.cl"
                                    type="email"
                                    value={formData.email_empresaservicios}
                                    onChange={(e) => setFormData({ ...formData, email_empresaservicios: e.target.value })}
                                    className="pl-8"
                                />
                            </div>
                        </Field>

                        <div className="mt-6 flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={handleClose}>
                                <IconX size={16} /> Cancelar
                            </Button>
                            <Button
                                type="submit"
                                style={{ backgroundColor: '#0b7285' }}
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                ) : (
                                    <IconCheck size={16} />
                                )}
                                Crear Empresa
                            </Button>
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
            {children}
        </div>
    );
}
