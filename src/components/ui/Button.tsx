import React from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none touch-manipulation smooth-hover scale-on-press ripple';
  
  const variantStyles = {
    primary: 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 active:from-primary-700 active:to-primary-800 text-white shadow-medium hover:shadow-strong hover:scale-105 active:scale-95',
    secondary: 'bg-gradient-to-r from-secondary-100 to-secondary-200 hover:from-secondary-200 hover:to-secondary-300 active:from-secondary-300 active:to-secondary-400 text-secondary-900 border border-secondary-300/50 shadow-soft hover:shadow-medium active:scale-95',
    success: 'bg-gradient-to-r from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 active:from-success-700 active:to-success-800 text-white shadow-medium hover:shadow-strong hover:scale-105 active:scale-95',
    danger: 'bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 active:from-error-700 active:to-error-800 text-white shadow-medium hover:shadow-strong hover:scale-105 active:scale-95',
    ghost: 'bg-transparent hover:bg-secondary-100/50 active:bg-secondary-200/50 text-secondary-900 hover:scale-105 active:scale-95',
  };
  
  const sizeStyles = {
    sm: 'text-xs xs:text-sm h-9 xs:h-10 px-2.5 xs:px-3',
    md: 'text-sm h-11 xs:h-12 px-3 xs:px-4',
    lg: 'text-sm xs:text-base h-12 xs:h-14 px-4 xs:px-6',
    icon: 'text-sm h-10 xs:h-11 w-10 xs:w-11',
  };
  
  const widthClass = fullWidth ? 'w-full' : '';
  
  return (
    <button
      className={clsx(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        widthClass,
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      
      {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};

export default Button;