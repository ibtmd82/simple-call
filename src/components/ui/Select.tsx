import React from 'react';
import clsx from 'clsx';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SelectOption[];
  label?: string;
  error?: string;
  onChange: (value: string) => void;
  fullWidth?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  options,
  label,
  value,
  onChange,
  error,
  className,
  fullWidth = false,
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={clsx('flex flex-col', fullWidth && 'w-full')}>
      {label && (
        <label className="mb-1 text-sm font-medium text-secondary-900">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={handleChange}
        className={clsx(
          'rounded-md border border-secondary-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors',
          'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
          error && 'border-error-500 focus:border-error-500 focus:ring-error-500',
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-error-500">{error}</p>}
    </div>
  );
};

export default Select;