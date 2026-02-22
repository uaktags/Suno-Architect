import React from 'react';

type ClassValue = string | false | null | undefined;

export const cx = (...values: ClassValue[]) => values.filter(Boolean).join(' ');

type UiTone = 'default' | 'console';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: UiTone;
}

export const AppCard: React.FC<CardProps> = ({ tone = 'default', className, ...props }) => (
  <div
    className={cx(
      tone === 'console'
        ? 'ui-console-panel'
        : 'rounded-xl border border-[var(--app-panel-border)] bg-[var(--app-panel)] p-4',
      className
    )}
    {...props}
  />
);

interface FieldLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  tone?: UiTone;
}

export const AppFieldLabel: React.FC<FieldLabelProps> = ({ tone = 'default', className, ...props }) => (
  <label
    className={cx(
      tone === 'console'
        ? 'ui-console-label'
        : 'block text-xs text-slate-400 mb-1',
      className
    )}
    {...props}
  />
);

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { tone?: UiTone };
type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { tone?: UiTone };
type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { tone?: UiTone };

export const AppInput = React.forwardRef<HTMLInputElement, InputProps>(function AppInput(
  { tone = 'default', className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cx(
        tone === 'console'
          ? 'ui-console-input'
          : 'w-full rounded-lg border border-[var(--app-panel-border)] bg-slate-900 text-sm text-white px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/60',
        className
      )}
      {...props}
    />
  );
});

export const AppSelect = React.forwardRef<HTMLSelectElement, SelectProps>(function AppSelect(
  { tone = 'default', className, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cx(
        tone === 'console'
          ? 'ui-console-input'
          : 'w-full rounded-lg border border-[var(--app-panel-border)] bg-slate-900 text-sm text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/60',
        className
      )}
      {...props}
    />
  );
});

export const AppTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function AppTextarea(
  { tone = 'default', className, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      className={cx(
        tone === 'console'
          ? 'ui-console-input'
          : 'w-full rounded-lg border border-[var(--app-panel-border)] bg-slate-900 text-sm text-white px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--app-accent)]/60',
        className
      )}
      {...props}
    />
  );
});

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'console-primary' | 'console-secondary' | 'console-danger' | 'console-success';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
type ButtonIcon = 'none' | 'icon' | 'icon-circle';

interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: UiTone;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ButtonIcon;
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-[10px]',
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

const iconClasses: Record<ButtonIcon, string> = {
  none: '',
  icon: 'p-1.5',
  'icon-circle': 'p-2 rounded-full',
};

const getDefaultStyles = (variant: ButtonVariant, tone: UiTone): string => {
  if (tone === 'console') {
    switch (variant) {
      case 'console-primary':
        return 'bg-cyan-700/80 border border-cyan-500/70 text-cyan-100 hover:bg-cyan-600/70';
      case 'console-secondary':
        return 'bg-transparent border border-cyan-500/50 text-cyan-200 hover:bg-cyan-900/40';
      case 'console-danger':
        return 'bg-red-900/60 border border-red-500/70 text-red-200 hover:bg-red-800/60';
      case 'console-success':
        return 'bg-emerald-900/60 border border-emerald-500/70 text-emerald-200 hover:bg-emerald-800/60';
      default:
        return 'ui-console-button';
    }
  }

  switch (variant) {
    case 'primary':
      return 'border border-[var(--app-accent)]/70 text-white bg-[var(--app-accent)]/15 hover:bg-[var(--app-accent)]/25';
    case 'danger':
      return 'border border-red-400/70 text-red-200 hover:bg-red-500/10';
    case 'success':
      return 'border border-emerald-400/70 text-emerald-200 hover:bg-emerald-500/10';
    case 'warning':
      return 'border border-amber-400/70 text-amber-200 hover:bg-amber-500/10';
    default:
      return 'border border-[var(--app-panel-border)] text-slate-200 hover:bg-[var(--app-tab-hover)]';
  }
};

export const AppButton: React.FC<AppButtonProps> = ({
  tone = 'default',
  variant = 'secondary',
  size = 'md',
  icon = 'none',
  className,
  type = 'button',
  ...props
}) => {
  const defaultStyles = getDefaultStyles(variant, tone);
  const sizeStyles = icon === 'none' ? sizeClasses[size] : '';
  const iconStyles = iconClasses[icon];

  return (
    <button
      type={type}
      className={cx(
        'rounded-lg font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        tone === 'console' 
          ? (variant === 'console-primary' || variant === 'console-secondary' || variant === 'console-danger' || variant === 'console-success' 
             ? defaultStyles 
             : 'ui-console-button')
          : defaultStyles,
        sizeStyles,
        iconStyles,
        className
      )}
      {...props}
    />
  );
};

type StatusState = 'idle' | 'done' | 'error' | 'warning' | 'info' | 'publishing';

const getStatusColorClass = (state: StatusState, tone: UiTone): string => {
  const stateToSemantic: Record<StatusState, { default: string; console: string }> = {
    idle: { default: 'text-slate-300', console: 'text-slate-400' },
    done: { default: 'text-emerald-300', console: 'text-emerald-400' },
    error: { default: 'text-red-300', console: 'text-red-400' },
    warning: { default: 'text-amber-300', console: 'text-amber-400' },
    info: { default: 'text-cyan-300', console: 'text-cyan-400' },
    publishing: { default: 'text-cyan-300', console: 'text-cyan-400' },
  };

  return tone === 'console' ? stateToSemantic[state].console : stateToSemantic[state].default;
};

interface StatusMessageProps {
  tone?: UiTone;
  state: StatusState;
  message: string;
  className?: string;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({ tone = 'default', state, message, className }) => {
  if (!message) return null;

  const colorClass = getStatusColorClass(state, tone);

  return <p className={cx('text-xs', colorClass, className)}>{message}</p>;
};

