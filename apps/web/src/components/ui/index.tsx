import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Card({ children, className = '', title }: CardProps) {
  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg ${className}`}>
      {title && (
        <div className="px-4 py-2 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'green' | 'red' | 'yellow' | 'gray' | 'blue';
  className?: string;
}

const badgeColors: Record<NonNullable<BadgeProps['variant']>, string> = {
  green: 'bg-green-900/50 text-green-400 border border-green-700',
  red: 'bg-red-900/50 text-red-400 border border-red-700',
  yellow: 'bg-yellow-900/50 text-yellow-400 border border-yellow-700',
  gray: 'bg-gray-700 text-gray-300 border border-gray-600',
  blue: 'bg-blue-900/50 text-blue-400 border border-blue-700',
};

export function Badge({ children, variant = 'gray', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeColors[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost' | 'buy' | 'sell';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const btnVariants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-900',
  danger: 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-900',
  ghost: 'bg-transparent hover:bg-gray-700 text-gray-300 border border-gray-600',
  buy: 'bg-green-600 hover:bg-green-700 text-white disabled:bg-green-900',
  sell: 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-900',
};

const btnSizes: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled ?? isLoading}
      className={`rounded font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${btnVariants[variant]} ${btnSizes[size]} ${className}`}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  suffix?: string;
}

export function Input({ label, error, suffix, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-gray-400">{label}</label>}
      <div className="relative">
        <input
          {...props}
          className={`w-full bg-gray-700 border ${error ? 'border-red-500' : 'border-gray-600'} rounded px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 ${suffix ? 'pr-16' : ''} ${className}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {suffix}
          </span>
        )}
      </div>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

interface AlertProps {
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
  className?: string;
}

const alertColors: Record<AlertProps['type'], string> = {
  error: 'bg-red-900/40 border-red-700 text-red-300',
  success: 'bg-green-900/40 border-green-700 text-green-300',
  warning: 'bg-yellow-900/40 border-yellow-700 text-yellow-300',
  info: 'bg-blue-900/40 border-blue-700 text-blue-300',
};

export function Alert({ type, message, onClose, className = '' }: AlertProps) {
  return (
    <div className={`border rounded px-4 py-3 text-sm flex items-center justify-between ${alertColors[type]} ${className}`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-4 opacity-70 hover:opacity-100">
          ✕
        </button>
      )}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`inline-block border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin ${className}`}
      style={{ width: 20, height: 20 }}
    />
  );
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <Spinner className="w-8 h-8" />
    </div>
  );
}
