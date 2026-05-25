import { cn } from '@/lib/utils';

interface LogoProps {
  iconClassName?: string;
  wordmarkClassName?: string;
  className?: string;
  href?: string;
  tone?: 'dark' | 'light';
  variant?: 'lockup' | 'mark';
}

export default function Logo({
  iconClassName,
  wordmarkClassName,
  className,
  href = '/',
  tone = 'dark',
  variant = 'lockup',
}: LogoProps) {
  const logoSrc =
    tone === 'light'
      ? '/images/brand/stuwiz-logo-light.png'
      : '/images/brand/stuwiz-logo-dark.png';

  if (variant === 'mark') {
    return (
      <a href={href} className={cn('inline-flex items-center', className)}>
        <img
          src="/images/brand/stuwiz-mark-tight.png"
          alt="Stuwiz Logo"
          width={56}
          height={29}
          className={cn('h-7 w-auto object-contain', iconClassName)}
        />
      </a>
    );
  }

  return (
    <a href={href} className={cn('inline-flex items-center', className)}>
      <img
        src={logoSrc}
        alt="Stuwiz"
        width={291}
        height={112}
        className={cn('h-10 w-auto object-contain', wordmarkClassName)}
      />
    </a>
  );
}
