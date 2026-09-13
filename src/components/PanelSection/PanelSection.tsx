import type { ReactNode } from 'react';

type Toggle = { label: string; checked: boolean; onChange: (checked: boolean) => void };
type Props = {
  id: string; className: string; title: string; subtitle?: ReactNode; toggle?: Toggle;
  status?: ReactNode; defaultOpen?: boolean; children: ReactNode;
};

/**
 * Collapsible panel section. The summary keeps state visible while collapsed,
 * and carries the layer's own switch so it can be used without opening.
 */
export function PanelSection({ id, className, title, subtitle, toggle, status, defaultOpen = false, children }: Props) {
  return <details id={id} className={'panel-section ' + className} open={defaultOpen}>
    <summary>
      {/* A label, so the whole 44px block is the target, not just the drawn switch. */}
      {toggle && <label
        className="summary-switch"
        // A click on the switch must not reach the summary, which would open the section.
        onClick={event => event.stopPropagation()}
      >
        <input
          type="checkbox" className="switch" aria-label={toggle.label} checked={toggle.checked}
          onChange={event => toggle.onChange(event.target.checked)}
        />
      </label>}
      <h2>{title}</h2>
      {subtitle && <span className="section-sub">{subtitle}</span>}
      {status && <span className="summary-status">{status}</span>}
    </summary>
    <div className="panel-section-body">{children}</div>
  </details>;
}
