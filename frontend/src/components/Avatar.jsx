import { useState, useEffect } from 'react';

const AVATAR_SIZES = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 56,
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const Avatar = ({ src, name, size = 'md', className = '', showPresence = false, isOnline = false }) => {
  const [imgError, setImgError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setImgError(false);
    setCurrentSrc(src);
  }, [src]);

  const px = AVATAR_SIZES[size] || AVATAR_SIZES.md;
  const showImage = currentSrc && !imgError;

  const wrapperClass = [
    'avatar',
    `avatar-${size}`,
    className,
    showPresence ? 'avatar-with-presence' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClass} style={{ width: px, height: px }}>
      {showImage ? (
        <img
          src={currentSrc}
          alt={name || 'Avatar'}
          className="avatar-img"
          onError={() => setImgError(true)}
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      ) : (
        <span className="avatar-initials" aria-label={name}>
          {getInitials(name)}
        </span>
      )}
      {showPresence && (
        <span
          className={`avatar-presence-dot ${isOnline ? 'avatar-online' : 'avatar-offline'}`}
          title={isOnline ? 'Online' : 'Offline'}
          aria-label={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};

export default Avatar;