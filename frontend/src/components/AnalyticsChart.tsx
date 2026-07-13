import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { SongByUser } from '../types';

interface AnalyticsChartProps {
  songsByUser: SongByUser[];
}

export default function AnalyticsChart({ songsByUser }: AnalyticsChartProps) {
  const data = songsByUser.map((item) => ({ name: item.name, count: item.count }));

  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1f2a3a" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#9fb0c3', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9fb0c3', fontSize: 12 }} />
          <Tooltip contentStyle={{ background: '#0f1b2d', border: '1px solid #223449' }} labelStyle={{ color: '#ffffff' }} itemStyle={{ color: '#ffffff' }} />
          <Bar dataKey="count" fill="#1db954" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
