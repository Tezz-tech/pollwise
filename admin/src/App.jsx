import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import LoginPage from './pages/LoginPage.jsx';

/**
 * Routes for the admin site. Phase 0 has only the placeholder sign-in page; the course builder and
 * the super admin area are added in Phases 5 and 6.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="*"
          element={
            <main className="flex min-h-full items-center justify-center p-lg text-center">
              <p className="text-pw-body text-ink600">That page does not exist.</p>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
