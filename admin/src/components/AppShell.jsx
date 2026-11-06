import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BookOpen, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { Logo } from './ui.jsx';

const ROLE_LABEL = { content_admin: 'Content admin', super_admin: 'Super admin' };

/**
 * App shell (DESIGN §7): ink sidebar with the white logo, a top bar with the page context, and page
 * content that fades and rises 8 px on route change (reduced motion: a plain fade).
 */
export default function AppShell() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const reduce = useReducedMotion();

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col gap-2xl bg-ink900 p-xl text-white">
        <Link to="/" aria-label="PollWise courses" className="inline-flex items-center">
          <Logo variant="white" />
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-xs">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `relative flex items-center gap-md rounded-md px-md py-md text-pw-body font-[700] transition-colors ${
                isActive ? 'bg-jade600/20 text-white' : 'text-white/80 hover:bg-white/10'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    className="absolute inset-y-2 left-0 w-1 rounded-pill bg-jade400"
                    aria-hidden="true"
                  />
                )}
                <BookOpen size={18} aria-hidden="true" />
                Courses
              </>
            )}
          </NavLink>
        </nav>
        <div className="mt-auto flex flex-col gap-sm rounded-lg bg-white/5 p-md">
          <p className="text-pw-small font-[700] text-white">{user?.name}</p>
          <p className="text-pw-small text-white/70">{ROLE_LABEL[user?.role] ?? ''}</p>
          <button
            type="button"
            onClick={signOut}
            className="mt-xs inline-flex items-center gap-sm rounded-md px-xs py-xs text-left text-pw-small font-[700] text-white/80 hover:text-white"
          >
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-surface px-2xl">
          <p className="text-pw-small font-[700] text-ink600">PollWise admin</p>
          <p className="text-pw-small text-ink600">Tezzer Technologies</p>
        </header>
        <main className="min-w-0 flex-1 p-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0.12 : 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
