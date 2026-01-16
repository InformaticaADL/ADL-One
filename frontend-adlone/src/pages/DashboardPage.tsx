import { MainLayout } from '../components/layout/MainLayout';

const DashboardPage = () => {
    return (
        <MainLayout>
            <div className="dashboard-content">
                <h1>Bienvenido a ADL One</h1>
                <p>Seleccione un módulo del menú lateral para comenzar.</p>

                {/* Aquí irán los widgets del dashboard en el futuro */}
                <div style={{
                    marginTop: '2rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '1.5rem'
                }}>
                    {['Solicitudes Pendientes', 'Muestras Hoy', 'Informes por Validar'].map((item) => (
                        <div key={item} style={{
                            background: 'white',
                            padding: '1.5rem',
                            borderRadius: '1rem',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                            borderTop: '4px solid #ff9800'
                        }}>
                            <h3 style={{ margin: '0 0 0.5rem 0', color: '#546e7a' }}>{item}</h3>
                            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1565c0' }}>12</span>
                        </div>
                    ))}
                </div>
            </div>
        </MainLayout>
    );
};

export default DashboardPage;
