import { RulesContent } from "../components/RulesContent";

interface WelcomePageProps {
  onContinue: () => void;
}

// Pantalla de bienvenida que ve quien entra por primera vez (sin nombre guardado).
// Presenta la polla y las reglas antes de elegir nombre.
export function WelcomePage({ onContinue }: WelcomePageProps) {
  return (
    <div className="welcome">
      <header className="welcome-hero">
        <h1 className="app-title">Polla Mundial 26</h1>
        <p className="welcome-tagline">La polla de la fase eliminatoria del Mundial 2026 entre amigos.</p>
      </header>

      <RulesContent />

      <button className="save-button welcome-cta" onClick={onContinue}>
        Entrar a la polla →
      </button>
    </div>
  );
}
