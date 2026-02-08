import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = "w-12 h-12" }) => {
  return (
    <img
      src="/logo-baru.png"
      alt="Logo LimbahGuna"
      className={`object-contain ${className}`}
    />
  );
};
