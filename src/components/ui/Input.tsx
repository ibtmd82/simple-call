import React from 'react';
import clsx from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  className,
  fullWidth = false,
  ...props
}) => {
  return (
    <div className={clsx('flex flex-col', fullWidth && 'w-full')}>
      {label && (
        <label className="mb-1 text-xs xs:text-sm font-medium text-secondary-900">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 xs:pl-3 pointer-events-none text-secondary-500">
            {leftIcon}
          </div>
        )}
        <input
          className={clsx(
            'rounded-md border border-secondary-200 bg-white px-2.5 xs:px-3 py-2.5 xs:py-2.5 text-sm shadow-sm transition-colors min-h-[44px]',
            'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
            error && 'border-error-500 focus:border-error-500 focus:ring-error-500',
            leftIcon && 'pl-9 xs:pl-10',
            rightIcon && 'pr-9 xs:pr-10',
            fullWidth && 'w-full',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 xs:pr-3 pointer-events-none text-secondary-500">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-[10px] xs:text-xs text-error-500">{error}</p>}
    </div>
  );
};

export default Input;