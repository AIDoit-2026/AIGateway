import { describe, expect, it } from 'vitest';
import { create } from 'react-test-renderer';
import ResponsiveFormGrid from './ResponsiveFormGrid.js';

describe('ResponsiveFormGrid', () => {
  it('applies the shared responsive grid class contract', () => {
    const root = create(
      <ResponsiveFormGrid columns={3}>
        <div>Field A</div>
        <div>Field B</div>
      </ResponsiveFormGrid>,
    );

    const container = root.root.findByType('div');
    expect(container.props.className).toContain('responsive-form-grid');
    expect(container.props.className).toContain('responsive-form-grid-3');
  });

  it('supports a minimum column width override', () => {
    const root = create(
      <ResponsiveFormGrid minColumnWidth={260}>
        <div>Field A</div>
        <div>Field B</div>
      </ResponsiveFormGrid>,
    );

    const container = root.root.findByType('div');
    expect(container.props.style).toEqual({
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
    });
  });
});
