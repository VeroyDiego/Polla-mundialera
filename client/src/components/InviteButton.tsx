// Botón para invitar amigos compartiendo el link de la polla por WhatsApp.
// Usa el origen actual, así funciona en cualquier despliegue sin configurar la URL.
export function InviteButton({ block }: { block?: boolean }) {
  const url = window.location.origin;
  const text = `¡Sumate a la Polla Mundial 26! ⚽ Pronosticá los partidos del Mundial 2026: ${url}`;
  const href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  return (
    <a className={block ? "invite-button invite-button--block" : "invite-button"} href={href} target="_blank" rel="noopener noreferrer">
      📲 Invitar por WhatsApp
    </a>
  );
}
