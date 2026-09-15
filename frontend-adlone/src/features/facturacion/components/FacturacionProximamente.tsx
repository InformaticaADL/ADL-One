import { IconClockHour4 } from '@tabler/icons-react';

interface Props {
    titulo: string;
    descripcion: string;
}

const FacturacionProximamente: React.FC<Props> = ({ titulo, descripcion }) => (
    <div className="flex h-full items-center justify-center p-10">
        <div className="flex flex-col items-center gap-3 text-center">
            <IconClockHour4 size={32} className="text-muted-foreground" />
            <div>
                <p className="mb-1 text-[15px] font-semibold text-foreground">{titulo}</p>
                <p className="text-sm text-muted-foreground">{descripcion}</p>
            </div>
        </div>
    </div>
);

export default FacturacionProximamente;
