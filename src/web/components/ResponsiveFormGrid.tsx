import React from 'react';

type ResponsiveFormGridProps = {
  columns?: 1 | 2 | 3;
  children: React.ReactNode;
  className?: string;
  minColumnWidth?: number;
};

export default function ResponsiveFormGrid({
  columns = 2,
  children,
  className,
  minColumnWidth,
}: ResponsiveFormGridProps) {
  const classes = [
    'responsive-form-grid',
    `responsive-form-grid-${columns}`,
    className,
  ].filter(Boolean).join(' ');

  const style = minColumnWidth
    ? { gridTemplateColumns: `repeat(auto-fit, minmax(min(${minColumnWidth}px, 100%), 1fr))` }
    : undefined;

  return <div className={classes} style={style}>{children}</div>;
}
