import { Folder } from '@/types';
import { FolderOpen, Video } from 'lucide-react';

interface FolderCardProps {
  folder: Folder;
  onClick?: () => void;
}

const colorMap: Record<string, string> = {
  amber: 'from-amber-500 to-orange-500',
  orange: 'from-orange-500 to-red-500',
  emerald: 'from-emerald-500 to-teal-500',
};

export default function FolderCard({ folder, onClick }: FolderCardProps) {
  const gradient = colorMap[folder.color || 'amber'];

  return (
    <div
      onClick={onClick}
      className="glass rounded-2xl p-6 card-hover group relative overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/20 h-full flex flex-col"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-300`} />

      <div className="relative flex flex-col h-full">
        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
          <FolderOpen className="w-7 h-7 text-white" />
        </div>

        <h3 className="text-xl font-bold mb-2 group-hover:text-amber-400 transition-colors line-clamp-2">
          {folder.name}
        </h3>

        <div className="flex items-center space-x-2 text-sm text-gray-400 mt-auto">
          <Video className="w-4 h-4" />
          <span>{folder.videoCount || 0} videos</span>
        </div>
      </div>
    </div>
  );
}
