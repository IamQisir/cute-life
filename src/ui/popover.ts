/** Menus share dismissal and keyboard handling; CSS gives them space in the top grid. */
export class Popover {
  constructor(private trigger: HTMLButtonElement, private menu: HTMLElement, private beforeOpen: () => void) {
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', menu.id);
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu.hidden) this.open();
      else this.close(true);
    });
    for (const control of [trigger, menu]) {
      // Space toggles play on keyup, so keep both events inside the menu.
      control.addEventListener('keyup', (e) => e.stopPropagation());
      control.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          this.close(true);
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          if (menu.hidden) this.open();
          else {
            const items = this.items();
            const i = items.indexOf(document.activeElement as HTMLButtonElement);
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
              : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
          }
        }
      });
      control.addEventListener('focusout', (e) => {
        if (!(e.relatedTarget instanceof Node) || (!menu.contains(e.relatedTarget) && !trigger.contains(e.relatedTarget))) this.close();
      });
    }
    document.addEventListener('pointerdown', (e) => {
      if (e.target instanceof Node && !menu.contains(e.target) && !trigger.contains(e.target)) this.close();
    });
    window.addEventListener('resize', () => { if (!menu.hidden) this.close(true); });
  }

  private items() {
    return [...this.menu.querySelectorAll<HTMLButtonElement>('button')]
      .filter((item) => !item.disabled && item.getClientRects().length > 0);
  }

  private open() {
    this.beforeOpen();
    this.menu.style.marginLeft = '0px';
    this.menu.hidden = false;
    // Preserve the mode button's left anchor, clamped inside the menu's grid row.
    // Vertical placement stays entirely in CSS, including the battle header below.
    const row = this.menu.parentElement!.getBoundingClientRect();
    const anchor = this.trigger.getBoundingClientRect();
    this.menu.style.marginLeft = `${Math.max(0, Math.min(anchor.left - row.left, row.width - this.menu.offsetWidth))}px`;
    this.trigger.setAttribute('aria-expanded', 'true');
    (this.items().find((item) => item.getAttribute('aria-checked') === 'true') ?? this.items()[0])?.focus();
  }

  close(restoreFocus = false) {
    this.menu.hidden = true;
    this.trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) this.trigger.focus();
  }
}
