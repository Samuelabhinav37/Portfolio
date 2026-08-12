/**
 * Chrome strings for BlogPost.astro's own layout (menu, share dialog, TOC
 * heading, etc.) in each supported locale. Scope is deliberately narrow:
 * this covers the static text ON the post-page shell, not the whole site —
 * the blog index, About/Contact, and Luna's chat companion stay English-only
 * for now. A post's actual content (title, description, body, FAQs) is
 * translated in its own MDX file, not here.
 */
export type BlogLocale = 'en' | 'es';

export const LOCALE_LABEL: Record<BlogLocale, string> = {
  en: 'English',
  es: 'Español',
};

interface BlogStrings {
  skipToContent: string;
  backToTop: string;
  openMenu: string;
  closeMenu: string;
  close: string;
  navAbout: string;
  navBlog: string;
  navContact: string;
  minRead: string;
  onThisPage: string;
  linkToSection: string;
  shareOnX: string;
  shareOnLinkedIn: string;
  copyLink: string;
  copy: string;
  shareDialogTitle: string;
  shareDialogHint: string;
  shareOnXGo: string;
  shareOnLinkedInGo: string;
  switchTo: (target: BlogLocale) => string;
  /** "This post is also available in X [and Y]." — the in-content notice
   *  near the hero (Cloudflare-style), not the footer. Takes label(s) of
   *  the OTHER language(s) this post has, already comma/"and"-joined. */
  alsoAvailable: (joinedLabels: string) => string;
  /** The conjunction word for joinLabels() — "and" / "y". */
  and: string;
}

/** "X" | "X and Y" | "X, Y, and Z" — used by alsoAvailable when more than
 *  one translation exists; today that's always a single label. */
export function joinLabels(labels: string[], and: string): string {
  if (labels.length <= 1) return labels[0] ?? '';
  if (labels.length === 2) return `${labels[0]} ${and} ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, ${and} ${labels[labels.length - 1]}`;
}

export const BLOG_STRINGS: Record<BlogLocale, BlogStrings> = {
  en: {
    skipToContent: 'Skip to content',
    backToTop: 'Back to top',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    close: 'Close',
    navAbout: 'About',
    navBlog: 'Blog',
    navContact: 'Contact',
    minRead: 'MIN READ',
    onThisPage: 'On this page',
    linkToSection: 'Link to this section',
    shareOnX: 'Share on X',
    shareOnLinkedIn: 'Share on LinkedIn',
    copyLink: 'Copy link',
    copy: 'Copy',
    shareDialogTitle: 'Share this post',
    shareDialogHint: "Preview how it'll look before you post it.",
    shareOnXGo: 'Share on X →',
    shareOnLinkedInGo: 'Share on LinkedIn →',
    switchTo: (target) => LOCALE_LABEL[target],
    alsoAvailable: (joined) => `This post is also available in ${joined}.`,
    and: 'and',
  },
  es: {
    skipToContent: 'Saltar al contenido',
    backToTop: 'Volver arriba',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    close: 'Cerrar',
    navAbout: 'Acerca de',
    navBlog: 'Blog',
    navContact: 'Contacto',
    minRead: 'MIN DE LECTURA',
    onThisPage: 'En esta página',
    linkToSection: 'Enlace a esta sección',
    shareOnX: 'Compartir en X',
    shareOnLinkedIn: 'Compartir en LinkedIn',
    copyLink: 'Copiar enlace',
    copy: 'Copiar',
    shareDialogTitle: 'Compartir esta publicación',
    shareDialogHint: 'Vista previa antes de publicarla.',
    shareOnXGo: 'Compartir en X →',
    shareOnLinkedInGo: 'Compartir en LinkedIn →',
    switchTo: (target) => LOCALE_LABEL[target],
    alsoAvailable: (joined) => `Este artículo también está disponible en ${joined}.`,
    and: 'y',
  },
};
