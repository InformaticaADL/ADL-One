import { Empty } from 'antd';

interface Props {
    titulo: string;
    descripcion: string;
}

const FacturacionProximamente: React.FC<Props> = ({ titulo, descripcion }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 40 }}>
        <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
                <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(0,0,0,0.85)', marginBottom: 4 }}>{titulo}</div>
                    <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)' }}>{descripcion}</div>
                </div>
            }
        />
    </div>
);

export default FacturacionProximamente;
