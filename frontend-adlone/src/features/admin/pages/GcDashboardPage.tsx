import React, { useEffect, useState } from 'react';
import { IconAlertCircle, IconCircleCheck, IconClock, IconAlertTriangle, IconTrendingUp, IconFolderOpen, IconUsers } from '@tabler/icons-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageHeader } from '../../../components/layout/PageHeader';
import { calidadService, type AuditoriaRow, type AccionRow } from '../services/calidad.service';

interface DashboardData {
  auditorias: AuditoriaRow[];
  acciones: AccionRow[];
  listadoQa: { filas: { cerrado?: boolean }[] };
  archivoQa: { casos: { id_archivo: number }[]; ultima_copia: string | null };
  programa: { filas: { meses?: Record<number, { estado?: string; id_auditoria?: number | null }> }[] };
}

const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  description?: string;
}> = ({ label, value, icon, color, description }) => (
  <Card className="p-4 border border-border">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className={`p-2 rounded-lg bg-${color}/10 text-${color}`}>
        {icon}
      </div>
    </div>
  </Card>
);

export const GcDashboardPage: React.FC<{ onNavigate?: (view: string) => void }> = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const anioActual = new Date().getFullYear();
        const [auditorias, acciones, listadoQa, archivoQa, programa] = await Promise.all([
          calidadService.listarAuditorias(anioActual),
          calidadService.listarAcciones(),
          calidadService.listadoQa({}),
          calidadService.archivoQa(),
          calidadService.programa(anioActual),
        ]);
        setData({ auditorias, acciones, listadoQa, archivoQa, programa });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error cargando datos';
        setError(errorMsg);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    cargarDatos();
  }, []);

  if (loading) return <div className="p-6 text-center">Cargando datos...</div>;
  if (error) return (
    <Alert variant="destructive" className="m-4">
      <IconAlertCircle className="h-4 w-4" />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
  if (!data) return null;

  const anioActual = new Date().getFullYear();

  // ── Auditorías ──
  const auditoriasProgramadas = data.auditorias.filter(a => a.estado === 'PLANIFICADA').length;
  const auditoriasEnCurso = data.auditorias.filter(a => a.estado === 'EN_CURSO').length;
  const auditoriasCerradas = data.auditorias.filter(a => a.estado === 'CERRADA').length;
  const auditoriasAnuladas = data.auditorias.filter(a => a.estado === 'ANULADA').length;
  const totalAuditorias = data.auditorias.length;

  // ── No conformidades ──
  const ncAbiertas = data.auditorias.reduce((sum, a) => sum + (a.no_conformidades || 0), 0);
  const ncVencidas = data.acciones.filter(a => a.origen === 'AUDITORIA_INTERNA' && a.vencida && a.estado === 'ABIERTA').length;

  // ── Acciones Correctivas ──
  const accionesAbiertas = data.acciones.filter(a => a.estado === 'ABIERTA').length;
  const accionesCerradas = data.acciones.filter(a => a.estado === 'CERRADA').length;
  const accionesVencidas = data.acciones.filter(a => a.vencida && a.estado === 'ABIERTA').length;
  const accionesAnuladas = data.acciones.filter(a => a.estado === 'ANULADA').length;

  // ── Acciones por origen ──
  const accionesPorOrigen = data.acciones.reduce(
    (acc, a) => {
      const origen = a.origen || 'SIN_ESPECIFICAR';
      const existing = acc.find(x => x.origen === origen);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ origen, count: 1 });
      }
      return acc;
    },
    [] as { origen: string; count: number }[]
  );

  // ── Quejas y Apelaciones ──
  const casosQa = data.listadoQa.filas || [];
  const totalQa = casosQa.length;
  const qaAbiertas = casosQa.filter(c => !c.cerrado).length;
  const qaCerradas = casosQa.filter(c => c.cerrado).length;
  const casosArchivados = data.archivoQa.casos.length;

  // ── Cumplimiento del programa anual ──
  const programa = data.programa;
  const cumplimientoPorcentaje =
    programa.filas?.length > 0
      ? Math.round(
          (programa.filas.filter((f) =>
            Object.values(f.meses || {}).some((m) => m.estado === 'AUDITADO' || m.id_auditoria)
          ).length /
            programa.filas.length) *
            100
        )
      : 0;

  // ── Auditorías por mes ──
  const auditoriasPorMes = Array.from({ length: 12 }, (_, i) => ({
    mes: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][i],
    mes_num: i + 1,
    cantidad: data.auditorias.filter(a => a.mes === i + 1).length,
  }));

  // ── Acciones por estado ──
  const accionesEstado = [
    { nombre: 'Abiertas', valor: accionesAbiertas, color: '#FF6B6B' },
    { nombre: 'Cerradas', valor: accionesCerradas, color: '#51CF66' },
    { nombre: 'Anuladas', valor: accionesAnuladas, color: '#868E96' },
  ].filter(x => x.valor > 0);

  const origenesLabels: Record<string, string> = {
    AUDITORIA_INTERNA: 'Aud. Interna',
    AUDITORIA_EXTERNA_2: 'Aud. Externa (2)',
    AUDITORIA_EXTERNA_3: 'Aud. Externa (3)',
    QUEJA: 'Queja',
    APELACION: 'Apelación',
    REVISION_GERENCIA: 'Rev. Gerencia',
    AUTODETECTADA: 'Autodetectada',
    OTRO: 'Otro',
    SIN_ESPECIFICAR: 'Sin especificar',
  };

  return (
    <div className="shadcn-scope w-full flex flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Dashboard · Calidad"
        subtitle={`Auditorías Internas, Acciones Correctivas y Quejas & Apelaciones ${anioActual}`}
      />

      <div className="space-y-6">
        {/* Row 1: Auditorías Internas */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Auditorías Internas (ISO 17020)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Auditorías"
              value={totalAuditorias}
              icon={<IconFolderOpen size={20} />}
              color="blue"
              description={`${auditoriasCerradas} cerradas`}
            />
            <StatCard
              label="Programadas"
              value={auditoriasProgramadas}
              icon={<IconClock size={20} />}
              color="gray"
            />
            <StatCard
              label="En Curso"
              value={auditoriasEnCurso}
              icon={<IconTrendingUp size={20} />}
              color="orange"
            />
            <StatCard
              label="Cumplimiento Programa"
              value={`${cumplimientoPorcentaje}%`}
              icon={<IconCircleCheck size={20} />}
              color="green"
            />
          </div>
        </div>

        {/* Charts: Auditorías por Mes y Cumplimiento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 border border-border">
            <h3 className="font-semibold mb-4">Auditorías por Mes</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={auditoriasPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="cantidad" fill="#4C6EF5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-4 border border-border">
            <h3 className="font-semibold mb-4">Estado de Auditorías</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Cerradas', value: auditoriasCerradas, color: '#51CF66' },
                    { name: 'En Curso', value: auditoriasEnCurso, color: '#FFA94D' },
                    { name: 'Programadas', value: auditoriasProgramadas, color: '#A8E6CF' },
                    { name: 'Anuladas', value: auditoriasAnuladas, color: '#888888' },
                  ].filter(x => x.value > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={(props: any) => `${props.name || 'Item'}: ${props.value || 0}`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {[
                    { name: 'Cerradas', value: auditoriasCerradas, color: '#51CF66' },
                    { name: 'En Curso', value: auditoriasEnCurso, color: '#FFA94D' },
                    { name: 'Programadas', value: auditoriasProgramadas, color: '#A8E6CF' },
                    { name: 'Anuladas', value: auditoriasAnuladas, color: '#888888' },
                  ]
                    .filter(x => x.value > 0)
                    .map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Row 2: No Conformidades */}
        <div>
          <h2 className="text-lg font-semibold mb-4">No Conformidades (NC)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard
              label="NC Abiertas"
              value={ncAbiertas}
              icon={<IconAlertCircle size={20} />}
              color="red"
              description="Por auditoría interna"
            />
            <StatCard
              label="NC Vencidas"
              value={ncVencidas}
              icon={<IconAlertTriangle size={20} />}
              color="crimson"
              description="Acciones vencidas sin cerrar"
            />
          </div>
        </div>

        {/* Row 3: Acciones Correctivas */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Acciones Correctivas (OI-FoGe-02)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Acciones"
              value={data.acciones.length}
              icon={<IconCircleCheck size={20} />}
              color="blue"
              description={`${accionesAbiertas} abiertas`}
            />
            <StatCard
              label="Abiertas"
              value={accionesAbiertas}
              icon={<IconClock size={20} />}
              color="orange"
            />
            <StatCard
              label="Cerradas"
              value={accionesCerradas}
              icon={<IconCircleCheck size={20} />}
              color="green"
            />
            <StatCard
              label="Vencidas"
              value={accionesVencidas}
              icon={<IconAlertCircle size={20} />}
              color="red"
              description="Plazo pasado sin cerrar"
            />
          </div>
        </div>

        {/* Charts: Acciones por origen y estado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 border border-border">
            <h3 className="font-semibold mb-4">Acciones por Origen</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={accionesPorOrigen.map(x => ({
                  ...x,
                  origenLabel: origenesLabels[x.origen] || x.origen,
                }))}
                layout="vertical"
                margin={{ left: 150 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis type="number" />
                <YAxis dataKey="origenLabel" type="category" width={140} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#4C6EF5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-4 border border-border">
            <h3 className="font-semibold mb-4">Acciones por Estado</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={accionesEstado}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={(props: any) => `${props.name || 'Item'}: ${props.value || 0}`}
                  outerRadius={80}
                  dataKey="valor"
                >
                  {accionesEstado.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Row 4: Quejas y Apelaciones */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Quejas y Apelaciones (OI-FoGe-06)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard
              label="Total Registrados"
              value={totalQa}
              icon={<IconUsers size={20} />}
              color="blue"
            />
            <StatCard
              label="Abiertos"
              value={qaAbiertas}
              icon={<IconClock size={20} />}
              color="orange"
            />
            <StatCard
              label="Cerrados"
              value={qaCerradas}
              icon={<IconCircleCheck size={20} />}
              color="green"
              description={`${casosArchivados} archivados`}
            />
          </div>
        </div>

        {/* Progress: Distribución QA */}
        {totalQa > 0 && (
          <Card className="p-4 border border-border">
            <h3 className="font-semibold mb-4">Distribución de Casos</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Abiertos</span>
                  <span className="text-sm text-muted-foreground">
                    {qaAbiertas} ({Math.round((qaAbiertas / totalQa) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${(qaAbiertas / totalQa) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Cerrados</span>
                  <span className="text-sm text-muted-foreground">
                    {qaCerradas} ({Math.round((qaCerradas / totalQa) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(qaCerradas / totalQa) * 100}%` }} />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Info de última sincronización */}
        {data.archivoQa.ultima_copia && (
          <Alert className="border-blue-200 bg-blue-50">
            <IconCircleCheck className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Archivo sincronizado: {new Date(data.archivoQa.ultima_copia).toLocaleString('es-CL')}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};
