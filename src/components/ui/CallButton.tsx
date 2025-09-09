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
  const baseStyles = 'flex items-center justify-center rounded-full transition-all duration-200 focus:outline-none touch-manipulation';
  
  const variantStyles = {
    answer: 'bg-success-500 text-white hover:bg-success-600 active:bg-success-700 shadow-lg',
    hangup: 'bg-error-500 text-white hover:bg-error-600 active:bg-error-700 shadow-lg',
    mute: active 
      ? 'bg-error-500 text-white hover:bg-error-600 active:bg-error-700 shadow-lg' 
      : 'bg-secondary-100 text-secondary-900 hover:bg-secondary-200 active:bg-secondary-300',
    video: active 
      ? 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 shadow-lg' 
      : 'bg-secondary-100 text-secondary-900 hover:bg-secondary-200 active:bg-secondary-300',
    neutral: 'bg-secondary-100 text-secondary-900 hover:bg-secondary-200 active:bg-secondary-300',
  };
  
  const sizeStyles = {
    small: 'h-10 w-10 p-2',
    medium: 'h-12 w-12 p-3',
    large: 'h-16 w-16 p-4',
  };
  
  const pulseClass = pulse ? 'animate-pulse-slow' : '';
  
  return (
    <button
      className={clsx(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        pulseClass,
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
};

export default CallButton;