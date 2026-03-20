import React, { useState } from 'react';
import { RequestsManager } from './RequestsManager';
import RequestTypePermissionsPage from './RequestTypePermissionsPage';

interface AdminUrsPageProps {
    onBack: () => void;
}

const AdminUrsPage: React.FC<AdminUrsPageProps> = ({ onBack }) => {
    const [view, setView] = useState<'LIST' | 'PERMISSIONS'>('LIST');
    const [selectedType, setSelectedType] = useState<any>(null);

    const handleManagePermissions = (type: any) => {
        setSelectedType(type);
        setView('PERMISSIONS');
    };

    if (view === 'PERMISSIONS' && selectedType) {
        return (
            <RequestTypePermissionsPage 
                requestType={selectedType} 
                onBack={() => {
                    setView('LIST');
                    setSelectedType(null);
                }} 
            />
        );
    }

    return (
        <RequestsManager 
            onBack={onBack}
            onConfigureType={handleManagePermissions}
        />
    );
};

export default AdminUrsPage;
