import React from 'react';
import clsx from 'clsx';

type CallButtonVariant = 'answer' | 'hangup' | 'mute' | 'video' | 'neutral';
type CallButtonSize = 'small' | 'medium' | 'large';

interface CallButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: CallButtonVariant;
  size?: CallButtonSize;
  icon: React.ReactNode;
  active?: boolean;
  pulse?: boolean;
}

export const CallButton: React.FC<CallButtonProps> = ({
  icon,
  variant = 'neutral',
  size = 'medium',
  active = false,
  pulse = false,
  className,
  ...props
}) => {
  const baseStyles = 'flex items-center justify-center rounded-full transition-all duration-300 focus:outline-none touch-manipulation smooth-hover scale-on-press';
  
  const variantStyles = {
    answer: 'bg-gradient-to-br from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 active:from-success-700 active:to-success-800 text-white shadow-strong hover:shadow-strong hover:scale-110 active:scale-95',
    hangup: 'bg-gradient-to-br from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 active:from-error-700 active:to-error-800 text-white shadow-strong hover:shadow-strong hover:scale-110 active:scale-95',
    mute: active 
      ? 'bg-gradient-to-br from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 active:from-error-700 active:to-error-800 text-white shadow-strong hover:shadow-strong hover:scale-110 active:scale-95' 
      : 'bg-gradient-to-br from-white to-secondary-100 hover:from-secondary-100 hover:to-secondary-200 active:from-secondary-200 active:to-secondary-300 text-secondary-900 border border-secondary-200/50 shadow-soft hover:shadow-medium active:scale-95',
    video: active 
      ? 'bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 active:from-primary-700 active:to-primary-800 text-white shadow-strong hover:shadow-strong hover:scale-110 active:scale-95' 
      : 'bg-gradient-to-br from-white to-secondary-100 hover:from-secondary-100 hover:to-secondary-200 active:from-secondary-200 active:to-secondary-300 text-secondary-900 border border-secondary-200/50 shadow-soft hover:shadow-medium active:scale-95',
    neutral: 'bg-gradient-to-br from-white to-secondary-100 hover:from-secondary-100 hover:to-secondary-200 active:from-secondary-200 active:to-secondary-300 text-secondary-900 border border-secondary-200/50 shadow-soft hover:shadow-medium active:scale-95',
  };
  
  const sizeStyles = {
    small: 'h-10 w-10 xs:h-11 xs:w-11 p-2',
    medium: 'h-12 w-12 xs:h-14 xs:w-14 sm:h-14 sm:w-14 p-3',
    large: 'h-14 w-14 xs:h-16 xs:w-16 sm:h-18 sm:w-18 p-4',
  };
  
  const pulseClass = pulse ? 'animate-pulse-glow' : '';
  
  return (
    <button
      className={clsx(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        pulseClass,
        'ripple',
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
};

export default CallButton;