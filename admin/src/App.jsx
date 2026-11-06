import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, RequireRole } from './lib/auth.jsx';
import AppShell from './components/AppShell.jsx';
import LoginPage from './pages/LoginPage.jsx';
import TotpPage from './pages/TotpPage.jsx';
import AcceptInvitePage from './pages/AcceptInvitePage.jsx';
const CoursesPage = lazy(() => import('./pages/CoursesPage.jsx'));
const CourseBuilderPage = lazy(() => import('./pages/CourseBuilderPage.jsx'));
const CoursePreviewPage = lazy(() => import('./pages/CoursePreviewPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const UsersPage = lazy(() => import('./pages/UsersPage.jsx'));
const UserDetailPage = lazy(() => import('./pages/UserDetailPage.jsx'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));
const AdminsPage = lazy(() => import('./pages/AdminsPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const AuditPage = lazy(() => import('./pages/AuditPage.jsx'));
const VerifyPage = lazy(() => import('./pages/VerifyPage.jsx'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false } },
});

const CONTENT_ROLES = ['content_admin', 'super_admin'];
const SUPER = ['super_admin'];

/** The admin site. Public routes first; everything under the shell needs a session and a content role. */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="p-2xl text-pw-body text-ink600">Loading…</div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/courses" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/login/totp" element={<TotpPage />} />
              <Route path="/accept-invite" element={<AcceptInvitePage />} />
              <Route path="/verify/:code" element={<VerifyPage />} />
              <Route
                element={
                  <RequireRole roles={CONTENT_ROLES}>
                    <AppShell />
                  </RequireRole>
                }
              >
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/courses/:id" element={<CourseBuilderPage />} />
                <Route path="/courses/:id/preview" element={<CoursePreviewPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <RequireRole roles={SUPER}>
                      <DashboardPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <RequireRole roles={SUPER}>
                      <UsersPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/users/:id"
                  element={
                    <RequireRole roles={SUPER}>
                      <UserDetailPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <RequireRole roles={SUPER}>
                      <ReportsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admins"
                  element={
                    <RequireRole roles={SUPER}>
                      <AdminsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RequireRole roles={SUPER}>
                      <SettingsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/audit"
                  element={
                    <RequireRole roles={SUPER}>
                      <AuditPage />
                    </RequireRole>
                  }
                />
              </Route>
              <Route
                path="*"
                element={
                  <p className="p-2xl text-pw-body text-ink600">That page does not exist.</p>
                }
              />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster position="bottom-right" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  );
}
