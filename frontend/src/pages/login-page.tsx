import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../modules/auth/auth-context';
import { LoadingSpinner } from '../components/loading-spinner';

export function LoginPage() {
  const { session, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  if (session) {
    return <Navigate to="/" replace />;
  }

  if (isLoggingIn) {
    return <LoadingSpinner message="Iniciando sesión..." />;
  }

  return (
    <div className="login-page">
      <form
        className="login-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setIsLoggingIn(true);

          try {
            await login(email.trim(), password);
            await Swal.fire({
              icon: 'success',
              title: 'Acceso correcto',
              text: 'Bienvenido al sistema.',
              confirmButtonText: 'Continuar',
            });
          } catch (requestError) {
            await Swal.fire({
              icon: 'error',
              title: 'No se pudo iniciar sesión',
              text: (requestError as Error).message,
              confirmButtonText: 'Entendido',
            });
          } finally {
            setIsLoggingIn(false);
          }
        }}
      >
        <p className="eyebrow">Acceso</p>
        <div className="brand-logo-wrap login-logo-wrap">
          <img
            className="institutional-logo"
            src="/policia-vial-estatal-oaxaca-seeklogo.png"
            alt="Policía Vial Estatal de Oaxaca"
          />
        </div>
        <h1>Sistema de control vehicular</h1>
        <p>Ingresa con tu cuenta para acceder a tu panel operativo.</p>

        <label className="field">
          <span>Correo</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>

        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button className="primary-button" type="submit">

          Entrar
        </button>
      </form>
    </div>
  );
}

