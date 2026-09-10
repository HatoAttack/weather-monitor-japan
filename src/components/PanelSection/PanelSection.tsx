import type { ReactNode } from 'react';

type Props = {
  id: string; className: string; title: string; subtitle: ReactNode;
  status?: ReactNode; defaultOpen?: boolean; children: ReactNode;
};

/** Collapsible panel section. The summary keeps state visible while collapsed. */
export function PanelSection({ id, className, title, subtitle, status, defaultOpen = false, children }: Props) {
  return <details id={id} className={'panel-section ' + className} open={defaultOpen}>
    <summary>
      <h2>{title}</h2>
      <span className="section-sub">{subtitle}</span>
      {status && <span className="summary-status">{status}</span>}
    </summary>
    <div className="panel-section-body">{children}</div>
  </details>;
}
