/**
 * Makes a whole card open its details without nesting buttons inside a button: this sits over the card (which must be `relative`) and any
 * real control inside the card (a download, a link, Edit, Delete) is raised above it with `relative z-10`. One tab stop, a clear name, and a
 * focus ring that follows the card's corners.
 */
export function CardOpenButton({ label, onOpen }: { label: string; onOpen: (button: HTMLElement) => void }) {
  return <button type="button" aria-haspopup="dialog" aria-label={label} onClick={event => onOpen(event.currentTarget)}
    className="absolute inset-0 z-0 cursor-pointer rounded-[inherit] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50" />;
}
