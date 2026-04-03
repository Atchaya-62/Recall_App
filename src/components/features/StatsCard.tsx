import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  gradient?: boolean;
}

export default function StatsCard({ icon: Icon, label, value, subtitle, gradient }: StatsCardProps) {
  return (
    <div className={`glass rounded-2xl p-6 card-hover ${gradient ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${gradient ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-white/5'}`}>
          <Icon className={`w-6 h-6 ${gradient ? 'text-black' : 'text-amber-400'}`} />
        </div>
      </div>
      
      <div>
        <p className="text-sm text-gray-400 mb-1">{label}</p>
        <p className="text-3xl font-bold mb-1">{value}</p>
        {subtitle && (
          <p className="text-xs text-gray-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
