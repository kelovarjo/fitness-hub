import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { ToastProvider, cx } from './ui';
import Today from './screens/Today';
import Train from './screens/Train';
import SessionScreen from './screens/SessionScreen';
import History, { SessionDetail } from './screens/History';
import Library, { ExerciseDetail } from './screens/Library';
import Body from './screens/Body';
import Settings from './screens/Settings';

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash || '#/today');
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash || '#/today');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

const TABS = [
  { href: '#/today', label: 'Today', icon: '◎' },
  { href: '#/train', label: 'Train', icon: '▤' },
  { href: '#/body', label: 'Body', icon: '◍' },
  { href: '#/settings', label: 'Settings', icon: '⚙' },
];

export default function App() {
  const hash = useHash();
  const parts = hash.replace(/^#\//, '').split('/');
  const route = parts[0];
  const active = useLiveQuery(() => db.sessions.where('status').equals('active').first(), []);

  let screen;
  switch (route) {
    case 'train': screen = <Train />; break;
    case 'session': screen = <SessionScreen />; break;
    case 'history': screen = parts[1] ? <SessionDetail id={parts[1]} /> : <History />; break;
    case 'library': screen = parts[1] ? <ExerciseDetail id={parts[1]} /> : <Library />; break;
    case 'body': screen = <Body />; break;
    case 'settings': screen = <Settings />; break;
    default: screen = <Today />;
  }
  const inSession = route === 'session';

  return (
    <ToastProvider>
      <div className={cx('mx-auto min-h-full max-w-lg', inSession ? 'pb-8' : active ? 'pb-40' : 'pb-28')}>{screen}</div>
      {!inSession && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur safe-bottom">
          {active && (
            <a href="#/session" className="mx-auto flex min-h-12 max-w-lg items-center justify-between bg-accent px-4 font-semibold text-black">
              <span>{active.templateName} in progress</span><span>Resume ›</span>
            </a>
          )}
          <div className="mx-auto grid max-w-lg grid-cols-4">
            {TABS.map((t) => {
              const on = hash.startsWith(t.href) || (t.href === '#/train' && /^#\/(history|library)/.test(hash));
              return (
                <a key={t.href} href={t.href} className={cx('flex min-h-[64px] flex-col items-center justify-center gap-0.5 text-xs', on ? 'text-accent' : 'text-mute')}>
                  <span className="text-xl leading-none" aria-hidden>{t.icon}</span>
                  {t.label}
                </a>
              );
            })}
          </div>
        </nav>
      )}
    </ToastProvider>
  );
}
