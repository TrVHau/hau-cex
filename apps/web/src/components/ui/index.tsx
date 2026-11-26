import React, { type ReactNode } from 'react';

// ─── Card ──────────────────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string | ReactNode;
  action?: ReactNode;
  noPadding?: boolean;
}

export function Card({ children, className = '', title, action, noPadding = false }: CardProps) {
  return (
    <div className={`bg-[#14171d] border border-[#232933] rounded-xl overflow-hidden ${className}`}>
      {title && (
        <div className="px-5 py-3.5 border-b border-[#232933] flex items-center justify-between">
          <div className="text-sm font-semibold text-[#eaecef]">{title}</div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </div>
  );
}

// ─── Badge ─────────────────────────────────────────────────────────────────
interface BadgeProps {
  children: ReactNode;
  variant?: 'green' | 'red' | 'yellow' | 'gray' | 'blue' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

const badgeVariants = {
  green: 'bg-[#0ecb81]/15 text-[#0ecb81] border-[#0ecb81]/30',
  red: 'bg-[#f6465d]/15 text-[#f6465d] border-[#f6465d]/30',
  yellow: 'bg-[#f5b642]/15 text-[#f5b642] border-[#f5b642]/30',
  gray: 'bg-[#848e9c]/15 text-[#848e9c] border-[#848e9c]/30',
  blue: 'bg-[#3b82f6]/15 text-[#60a5fa] border-[#3b82f6]/30',
  purple: 'bg-[#8b5cf6]/15 text-[#a78bfa] border-[#8b5cf6]/30',
};

export function Badge({ children, variant = 'gray', size = 'sm', className = '' }: BadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded border ${badgeVariants[variant]} ${sizeClasses} ${className}`}
    >
      {children}
    </span>
  );
}

// ─── Button ────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'buy' | 'sell' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const btnVariants = {
  primary: 'bg-[#f5b642] hover:bg-[#e5a835] text-black font-semibold',
  secondary: 'bg-[#1e232d] hover:bg-[#282f3c] text-[#eaecef] border border-[#2b3240]',
  buy: 'bg-[#0ecb81] hover:bg-[#0bb371] text-white font-semibold',
  sell: 'bg-[#f6465d] hover:bg-[#df3b51] text-white font-semibold',
  outline: 'border border-[#2b3240] hover:border-[#f5b642] text-[#eaecef] hover:text-[#f5b642] bg-transparent',
  ghost: 'bg-transparent hover:bg-[#1e232d] text-[#848e9c] hover:text-[#eaecef]',
  danger: 'bg-[#f6465d]/20 hover:bg-[#f6465d]/30 text-[#f6465d] border border-[#f6465d]/40',
};

const btnSizes = {
  xs: 'px-2 py-1 text-xs rounded',
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-5 py-2.5 text-base rounded-lg',
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
      className={`inline-flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${btnVariants[variant]} ${btnSizes[size]} ${className}`}
    >
      {isLoading ? (
        <>
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

// ─── Input ─────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  suffix?: ReactNode;
  prefixIcon?: ReactNode;
}

export function Input({
  label,
  error,
  suffix,
  prefixIcon,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-xs font-medium text-[#848e9c]">{label}</label>}
      <div className="relative flex items-center">
        {prefixIcon && (
          <div className="absolute left-3 text-[#5e6673] pointer-events-none">
            {prefixIcon}
          </div>
        )}
        <input
          {...props}
          className={`w-full bg-[#1b2028] border ${
            error ? 'border-[#f6465d]' : 'border-[#282f3c] focus:border-[#f5b642]'
          } rounded-lg py-2 text-sm text-[#eaecef] placeholder-[#5e6673] outline-none transition-colors ${
            prefixIcon ? 'pl-9' : 'pl-3'
          } ${suffix ? 'pr-14' : 'pr-3'} ${className}`}
        />
        {suffix && (
          <div className="absolute right-3 text-xs text-[#848e9c] font-medium pointer-events-none">
            {suffix}
          </div>
        )}
      </div>
      {error && <span className="text-xs text-[#f6465d]">{error}</span>}
    </div>
  );
}

// ─── StatCard ──────────────────────────────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string | ReactNode;
  subtitle?: string | ReactNode;
  badge?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ title, value, subtitle, badge, icon, className = '' }: StatCardProps) {
  return (
    <div className={`bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between text-xs text-[#848e9c] mb-2">
        <span className="font-medium flex items-center gap-1.5">
          {icon && <span className="text-[#f5b642]">{icon}</span>}
          {title}
        </span>
        {badge}
      </div>
      <div className="text-xl sm:text-2xl font-bold text-[#eaecef] font-numeric tracking-tight">{value}</div>
      {subtitle && <div className="text-xs text-[#848e9c] mt-1.5 flex items-center gap-1.5">{subtitle}</div>}
    </div>
  );
}

// ─── Alert ─────────────────────────────────────────────────────────────────
interface AlertProps {
  type: 'error' | 'success' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
  className?: string;
}

const alertVariants = {
  error: 'bg-[#f6465d]/10 border-[#f6465d]/30 text-[#f6465d]',
  success: 'bg-[#0ecb81]/10 border-[#0ecb81]/30 text-[#0ecb81]',
  warning: 'bg-[#f5b642]/10 border-[#f5b642]/30 text-[#f5b642]',
  info: 'bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#60a5fa]',
};

export function Alert({ type, message, onClose, className = '' }: AlertProps) {
  return (
    <div className={`border rounded-lg px-4 py-3 text-sm flex items-center justify-between ${alertVariants[type]} ${className}`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-4 opacity-70 hover:opacity-100 cursor-pointer">
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Spinner ───────────────────────────────────────────────────────────────
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`inline-block border-2 border-[#232933] border-t-[#f5b642] rounded-full animate-spin ${className}`}
      style={{ width: 24, height: 24 }}
    />
  );
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner className="w-8 h-8" />
    </div>
  );
}

export { CoinIcon, PairIcon } from './CoinIcon';
