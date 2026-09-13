import { useEffect, useId, useRef, useState } from 'react';

type Props = { label: string; children: React.ReactNode };

/**
 * An ⓘ button that keeps a standing explanation out of the panel until it is
 * wanted. The text appears on hover, on click or tap, and on keyboard focus.
 * Only explanations belong here; data times and update states stay on show.
 */
export function InfoHint({ label, children }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'down' | 'up'>('down');
  // Escape closes the text while the button keeps focus, which on its own would
  // hold the text open. The suppression lifts once the pointer or focus leaves.
  const [dismissed, setDismissed] = useState(false);
  const hint = useRef<HTMLSpanElement>(null);
  // The panel scrolls and clips its content, so a hint near its foot opens upwards.
  const place = () => {
    const button = hint.current?.firstElementChild?.getBoundingClientRect();
    const popup = hint.current?.lastElementChild?.getBoundingClientRect();
    const panel = hint.current?.closest('.panel')?.getBoundingClientRect();
    if (!button || !popup || !panel) return;
    setPlacement(button.bottom + popup.height > panel.bottom ? 'up' : 'down');
  };
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      // A pointer inside the hint is the button itself, which toggles on its own.
      if (event instanceof PointerEvent && hint.current?.contains(event.target as Node)) return;
      setOpen(false);
      if (event instanceof KeyboardEvent) setDismissed(true);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', close);
    };
  }, [open]);
  return <span
    className={'info-hint' + (open ? ' info-hint-open' : '') + (dismissed ? ' info-hint-dismissed' : '')}
    ref={hint} data-placement={placement}
    onPointerEnter={place} onFocus={place}
    onPointerLeave={() => setDismissed(false)} onBlur={() => setDismissed(false)}
  >
    <button
      type="button" className="info-button" aria-label={label} aria-expanded={open} aria-controls={id}
      onClick={() => { place(); setDismissed(false); setOpen(value => !value); }}
    >
      <svg viewBox="0 0 22 22" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="8.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="11" cy="6.6" r="1.15" fill="currentColor" />
        <path d="M11 9.8v6.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
    <span className="info-popup" id={id} role="tooltip">{children}</span>
  </span>;
}
