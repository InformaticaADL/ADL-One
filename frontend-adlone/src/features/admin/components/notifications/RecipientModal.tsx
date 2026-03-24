import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Users, ShieldCheck, Mail, Save, User, Search, Zap, Bell, CheckCircle2, AlertCircle } from 'lucide-react';
import { rbacService } from '../../services/rbac.service';
import { notificationService } from '../../../../services/notification.service';
import { useToast } from '../../../../contexts/ToastContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    event: {
        id: number;
        codigo: string;
        descripcion: string;
        es_transaccional?: boolean;
        config?: any[];
    };
    onSaved: () => void;
}

export const RecipientModal: React.FC<Props> = ({ isOpen, onClose, event, onSaved }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    
    // Catalogos
    const [allRoles, setAllRoles] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    
    // Form State
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [notifyOwner, setNotifyOwner] = useState(false);
    const [ccEmails, setCcEmails] = useState('');
    const [showCc, setShowCc] = useState(false);
    const [channels, setChannels] = useState({ email: true, web: true });
    
    // Autocomplete State
    const [searchTerm, setSearchTerm] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            loadData();
            processExistingConfig();
            setShowCc(false);
        }
    }, [isOpen, event]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const loadData = async () => {
        try {
            const [roles, users] = await Promise.all([
                rbacService.getRoles(),
                rbacService.getUsers()
            ]);
            setAllRoles(roles);
            setAllUsers(users);
        } catch (error) {
            console.error(error);
        }
    };

    const processExistingConfig = () => {
        if (!event.config || event.config.length === 0) {
            setSelectedRoles([]);
            setSelectedUsers([]);
            setNotifyOwner(false);
            setCcEmails('');
            setChannels({ email: false, web: false });
            return;
        }

        const roles: number[] = [];
        const users: number[] = [];
        let owner = false;
        let cc = '';
        let email = false;
        let web = false;

        event.config.forEach((c, idx) => {
            if (c.id_rol) roles.push(c.id_rol);
            if (c.id_usuario) users.push(c.id_usuario);
            if (c.es_propietario) owner = true;
            if (c.cc_emails) {
                cc = c.cc_emails;
                setShowCc(true);
            }
            if (idx === 0) {
                email = !!c.envia_email;
                web = !!c.envia_web;
            }
        });

        setSelectedRoles([...new Set(roles)]);
        setSelectedUsers([...new Set(users)]);
        setNotifyOwner(owner);
        setCcEmails(cc);
        setChannels({ email, web });
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const configs: any[] = [];

            if (event.es_transaccional) {
                configs.push({ envia_email: channels.email, envia_web: channels.web });
            } else {
                selectedRoles.forEach(roleId => configs.push({ id_rol: roleId, envia_email: channels.email, envia_web: channels.web, cc_emails: ccEmails }));
                selectedUsers.forEach(userId => configs.push({ id_usuario: userId, envia_email: channels.email, envia_web: channels.web, cc_emails: ccEmails }));
                if (notifyOwner) configs.push({ es_propietario: true, envia_email: channels.email, envia_web: channels.web, cc_emails: ccEmails });
                if (configs.length === 0 && ccEmails) configs.push({ cc_emails: ccEmails, envia_email: true, envia_web: false });
            }

            await notificationService.saveNotificationConfig(event.id, configs);
            showToast({ type: 'success', message: 'Configuración guardada correctamente' });
            onSaved();
            onClose();
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', message: 'Error al guardar configuración' });
        } finally {
            setLoading(false);
        }
    };

    // Derived States for Autocomplete
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return [];
        const term = searchTerm.toLowerCase();
        const roleMatches = allRoles.filter(r => r.nombre_rol.toLowerCase().includes(term) && !selectedRoles.includes(r.id_rol)).map(r => ({ type: 'role', id: r.id_rol, label: r.nombre_rol, email: undefined }));
        const userMatches = allUsers.filter(u => 
            (u.nombre_usuario?.toLowerCase().includes(term) || u.correo_electronico?.toLowerCase().includes(term)) && !selectedUsers.includes(u.id_usuario)
        ).map(u => ({ type: 'user', id: u.id_usuario, label: u.nombre_usuario, email: u.correo_electronico }));
        return [...roleMatches, ...userMatches];
    }, [searchTerm, allRoles, allUsers, selectedRoles, selectedUsers]);

    const selectedChips = useMemo(() => {
        const chips: any[] = [];
        selectedRoles.forEach(id => {
            const role = allRoles.find(r => r.id_rol === id);
            if (role) chips.push({ type: 'role', id, label: role.nombre_rol });
        });
        selectedUsers.forEach(id => {
            const user = allUsers.find(u => u.id_usuario === id);
            if (user) chips.push({ type: 'user', id, label: user.nombre_usuario });
        });
        return chips;
    }, [selectedRoles, selectedUsers, allRoles, allUsers]);

    const handleSelectOption = (opt: any) => {
        if (opt.type === 'role') setSelectedRoles(p => [...p, opt.id]);
        else setSelectedUsers(p => [...p, opt.id]);
        setSearchTerm('');
        setShowSuggestions(false);
    };

    const handleRemoveChip = (type: string, id: number) => {
        if (type === 'role') setSelectedRoles(p => p.filter(x => x !== id));
        else setSelectedUsers(p => p.filter(x => x !== id));
    };

    if (!isOpen) return null;

    return (
        <div className="drawer-overlay" onClick={onClose}>
            <div className={`drawer-content ${isOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ padding: '2rem 2.5rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#fff' }}>
                    <div>
                        <div style={{ display: 'inline-block', padding: '4px 8px', backgroundColor: '#e0f2fe', color: '#0284c7', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '8px' }}>
                            {event.codigo}
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Configurar Notificación</h2>
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '1rem', color: '#64748b' }}>{event.descripcion}</p>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Body - Two Columns */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                    
                    {/* Left Column: Config */}
                    <div style={{ flex: '0 0 65%', padding: '2.5rem', overflowY: 'auto', borderRight: '1px solid #e2e8f0' }}>
                        
                        {/* 1. Canales */}
                        <div style={{ marginBottom: '2.5rem' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', backgroundColor: '#3b82f6', color: 'white', borderRadius: '50%', fontSize: '12px' }}>1</span>
                                ¿Por qué canales enviamos?
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {/* Channel Card: Email */}
                                <div 
                                    onClick={() => setChannels(p => ({...p, email: !p.email}))}
                                    style={{ 
                                        padding: '1.25rem', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                                        backgroundColor: channels.email ? '#eff6ff' : '#fff',
                                        border: `2px solid ${channels.email ? '#3b82f6' : '#e2e8f0'}`,
                                        display: 'flex', alignItems: 'center', gap: '1rem'
                                    }}
                                >
                                    <div style={{ backgroundColor: channels.email ? '#bfdbfe' : '#f1f5f9', padding: '10px', borderRadius: '10px', color: channels.email ? '#1d4ed8' : '#94a3b8' }}>
                                        <Mail size={24} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>Correo Electrónico</div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>A la bandeja de entrada</div>
                                    </div>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${channels.email ? '#3b82f6' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: channels.email ? '#3b82f6' : 'transparent' }}>
                                        {channels.email && <CheckCircle2 size={16} color="white" />}
                                    </div>
                                </div>
                                {/* Channel Card: Web */}
                                <div 
                                    onClick={() => setChannels(p => ({...p, web: !p.web}))}
                                    style={{ 
                                        padding: '1.25rem', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                                        backgroundColor: channels.web ? '#eff6ff' : '#fff',
                                        border: `2px solid ${channels.web ? '#3b82f6' : '#e2e8f0'}`,
                                        display: 'flex', alignItems: 'center', gap: '1rem'
                                    }}
                                >
                                    <div style={{ backgroundColor: channels.web ? '#bfdbfe' : '#f1f5f9', padding: '10px', borderRadius: '10px', color: channels.web ? '#1d4ed8' : '#94a3b8' }}>
                                        <Bell size={24} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem' }}>Campanita App</div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Notificación dentro de URS</div>
                                    </div>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${channels.web ? '#3b82f6' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: channels.web ? '#3b82f6' : 'transparent' }}>
                                        {channels.web && <CheckCircle2 size={16} color="white" />}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Destinatarios */}
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#334155', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', backgroundColor: '#3b82f6', color: 'white', borderRadius: '50%', fontSize: '12px' }}>2</span>
                                ¿A quién le notificamos?
                            </h3>
                            
                            {event.es_transaccional ? (
                                <div style={{ backgroundColor: '#fff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                    <div style={{ padding: '10px', backgroundColor: '#eff6ff', borderRadius: '50%' }}>
                                        <Zap size={24} color="#3b82f6" />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 700, color: '#1e3a8a' }}>Evento Transaccional Dinámico</h3>
                                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', lineHeight: 1.6 }}>
                                            Este es un evento "Maestro". No necesitas asignar usuarios manualmente. El sistema detectará en el momento exacto a quién debe avisar (Ej: Al responsable actual o al creador). <br/><br/>
                                            <strong>Tu configuración queda lista definiendo únicamente los Canales en el Paso 1.</strong>
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    
                                    {/* AutoComplete Block */}
                                    <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                                            Buscar Roles o Usuarios Específicos
                                        </label>
                                        
                                        <div ref={wrapperRef} style={{ position: 'relative' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', backgroundColor: '#fff', transition: 'border-color 0.2s' }}>
                                                <Search size={18} color="#94a3b8" style={{ marginRight: '8px' }} />
                                                <input 
                                                    type="text" 
                                                    value={searchTerm}
                                                    onChange={e => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
                                                    onFocus={() => setShowSuggestions(true)}
                                                    placeholder="Ej: Administrador, Operador, Juan Perez..."
                                                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.95rem', backgroundColor: 'transparent' }}
                                                />
                                            </div>

                                            {/* Dropdown Suggestions */}
                                            {showSuggestions && searchTerm && (
                                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '4px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '250px', overflowY: 'auto' }}>
                                                    {filteredOptions.length === 0 ? (
                                                        <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>No se encontraron coincidencias</div>
                                                    ) : (
                                                        filteredOptions.map((opt, i) => (
                                                            <div 
                                                                key={`${opt.type}-${opt.id}`}
                                                                onClick={() => handleSelectOption(opt)}
                                                                style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderBottom: i === filteredOptions.length - 1 ? 'none' : '1px solid #f1f5f9' }}
                                                            >
                                                                {opt.type === 'role' ? <Users size={16} color="#0284c7" /> : <User size={16} color="#8b5cf6" />}
                                                                <div>
                                                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{opt.label}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{opt.type === 'role' ? 'Rol General' : opt.email || 'Usuario'}</div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Chips Area */}
                                        {selectedChips.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '1rem' }}>
                                                {selectedChips.map(chip => (
                                                    <div key={`${chip.type}-${chip.id}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', backgroundColor: chip.type === 'role' ? '#e0f2fe' : '#f3e8ff', border: `1px solid ${chip.type === 'role' ? '#bae6fd' : '#e9d5ff'}`, borderRadius: '100px' }}>
                                                        {chip.type === 'role' ? <Users size={12} color="#0369a1" /> : <User size={12} color="#7e22ce" />}
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: chip.type === 'role' ? '#0369a1' : '#7e22ce' }}>{chip.label}</span>
                                                        <button onClick={() => handleRemoveChip(chip.type, chip.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: chip.type === 'role' ? '#0284c7' : '#9333ea', marginLeft: '4px' }}>
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Owner Switch */}
                                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ backgroundColor: '#ecfdf5', padding: '8px', borderRadius: '8px', color: '#10b981' }}>
                                                <ShieldCheck size={20} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>Propietario del Registro</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Avisar siempre a quien creó o es dueño de la data.</div>
                                            </div>
                                        </div>
                                        <div style={{ position: 'relative', width: '44px', height: '24px', backgroundColor: notifyOwner ? '#10b981' : '#cbd5e1', borderRadius: '100px', transition: 'background-color 0.2s' }}>
                                            <div style={{ position: 'absolute', top: '2px', left: notifyOwner ? '22px' : '2px', width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}></div>
                                            <input type="checkbox" checked={notifyOwner} onChange={e => setNotifyOwner(e.target.checked)} style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
                                        </div>
                                    </label>

                                    {/* CC Emails Block */}
                                    <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                                        <div 
                                            onClick={() => setShowCc(!showCc)}
                                            style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: showCc ? '#f8fafc' : '#fff' }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <Mail size={18} color="#f59e0b" />
                                                <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>Copias Externas (CC)</span>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: 600 }}>
                                                {showCc ? 'Cerrar' : '+ Añadir Correos'}
                                            </div>
                                        </div>
                                        {showCc && (
                                            <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', borderTop: '1px solid #e2e8f0' }}>
                                                <textarea 
                                                    placeholder="ej: gerencia@empresa.com, auditor@gmail.com"
                                                    value={ccEmails}
                                                    onChange={e => setCcEmails(e.target.value)}
                                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', minHeight: '80px', marginTop: '1rem', outline: 'none' }}
                                                />
                                                <p style={{ margin: '8px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>Separa direcciones con comas. Solo por Email.</p>
                                            </div>
                                        )}
                                    </div>
                                    
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Visual Summary */}
                    <div style={{ flex: '0 0 35%', backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '2.5rem 2rem', flex: 1 }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle2 size={20} color="#10b981" /> Resumen en Vivo
                            </h3>
                            
                            <div style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '1.5rem' }}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8', marginBottom: '0.5rem' }}>Se enviará por:</div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {channels.email && <span style={{ padding: '4px 8px', backgroundColor: '#e0f2fe', color: '#0284c7', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={12}/> EMAIL</span>}
                                        {channels.web && <span style={{ padding: '4px 8px', backgroundColor: '#fef3c7', color: '#d97706', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}><Bell size={12}/> APP WEB</span>}
                                        {!channels.email && !channels.web && <span style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600 }}>Ningún canal activo</span>}
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8', marginBottom: '0.75rem' }}>Destinatarios:</div>
                                    
                                    {event.es_transaccional ? (
                                        <div style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fff', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                            <Zap size={14} color="#3b82f6" /> Resueltos automáticamente
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {notifyOwner && (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                    <ShieldCheck size={14} color="#10b981" style={{ marginTop: '2px' }}/> 
                                                    <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>Propietario del Registro</span>
                                                </div>
                                            )}
                                            
                                            {selectedRoles.length > 0 && (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                    <Users size={14} color="#0284c7" style={{ marginTop: '2px' }}/> 
                                                    <div>
                                                        <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600, display: 'block' }}>Roles</span>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedChips.filter(c => c.type === 'role').map(c => c.label).join(', ')}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedUsers.length > 0 && (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                    <User size={14} color="#7e22ce" style={{ marginTop: '2px' }}/> 
                                                    <div>
                                                        <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600, display: 'block' }}>Usuarios Específicos</span>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedChips.filter(c => c.type === 'user').map(c => c.label).join(', ')}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {ccEmails && (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                    <Mail size={14} color="#f59e0b" style={{ marginTop: '2px' }}/> 
                                                    <div>
                                                        <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600, display: 'block' }}>Copia (CC)</span>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', wordBreak: 'break-all' }}>{ccEmails.substring(0, 30)}{ccEmails.length > 30 ? '...' : ''}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {!notifyOwner && selectedRoles.length === 0 && selectedUsers.length === 0 && !ccEmails && (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#ef4444' }}>
                                                    <AlertCircle size={14} style={{ marginTop: '2px' }}/> 
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>No hay destinatarios configurados. La alerta no será enviada a nadie.</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Summary Footer Actions */}
                        <div style={{ padding: '1.5rem 2rem', backgroundColor: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button 
                                onClick={handleSave} 
                                disabled={loading}
                                style={{ width: '100%', padding: '1rem', backgroundColor: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(29, 78, 216, 0.3)' }}
                            >
                                {loading ? 'Procesando...' : <><Save size={18} /> CONFIRMAR Y GUARDAR</>}
                            </button>
                            <button 
                                onClick={onClose} 
                                disabled={loading}
                                style={{ width: '100%', padding: '0.75rem', backgroundColor: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
                            >
                                Cancelar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .drawer-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(4px);
                    display: flex;
                    justify-content: flex-end;
                    z-index: 9999;
                    animation: fadeIn 0.3s ease forwards;
                }
                .drawer-content {
                    width: 85%;
                    max-width: 950px;
                    height: 100vh;
                    background: #fff;
                    display: flex;
                    flex-direction: column;
                    box-shadow: -10px 0 25px rgba(0,0,0,0.1);
                    transform: translateX(100%);
                    animation: slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideLeft {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
            `}</style>
        </div>
    );
};
