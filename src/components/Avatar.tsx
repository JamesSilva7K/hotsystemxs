import React, { useState } from 'react';
import { initials } from '../lib/format';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
};

export function Avatar({ src, name, size = 'md' }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={`${sizes[size]} shrink-0 rounded-2xl border border-[#2a3346] bg-[#1a1f2b] object-cover`}
      />
    );
  }
  return (
    <div
      className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-2xl border border-[#2a3346] bg-gradient-to-br from-[#202839] to-[#141923] font-bold text-[#d4f933]`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
