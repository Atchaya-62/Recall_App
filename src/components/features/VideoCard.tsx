import { Video } from '@/types';
import { Clock, ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface VideoCardProps {
  video: Video;
  folderName?: string;
}

export default function VideoCard({ video, folderName }: VideoCardProps) {
  return (
    <Link
      to={`/video/${video.id}`}
      className="glass rounded-2xl overflow-hidden card-hover group h-full flex flex-col transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/20"
    >
      <div className="relative h-48 overflow-hidden flex-shrink-0">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {video.duration && (
          <div className="absolute bottom-3 right-3 glass-strong px-2 py-1 rounded-lg text-xs font-medium">
            {video.duration}
          </div>
        )}

        {video.watched ? (
          <CheckCircle2 className="absolute top-3 right-3 w-6 h-6 text-emerald-400" />
        ) : (
          <Circle className="absolute top-3 right-3 w-6 h-6 text-gray-400" />
        )}
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <div className="flex items-center justify-between mb-3">
          {folderName && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {folderName}
            </span>
          )}
          <div className="flex items-center space-x-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <h3 className="text-lg font-bold mb-2 line-clamp-2 group-hover:text-amber-400 transition-colors">
          {video.title}
        </h3>

        <p className="text-sm text-gray-400 line-clamp-2 mb-4 flex-grow">
          {video.summary || 'Summary is being generated...'}
        </p>

        <div className="flex items-center justify-between mt-auto">
          <span className="text-xs text-gray-500">
            {video.notes.length} notes • {video.flashcardsCount || 0} flashcards
          </span>

          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-amber-400 transition-colors" />
        </div>
      </div>
    </Link>
  );
}
