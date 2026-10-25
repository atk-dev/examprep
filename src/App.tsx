import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { db } from './db/db';
import { seedIfEmpty } from './db/actions';
import { useAppData } from './hooks/useAppData';
import Layout from './components/Layout';
import Setup from './pages/Setup';
import Today from './pages/Today';
import Log from './pages/Log';
import Review from './pages/Review';
import Progress from './pages/Progress';
import SettingsPage from './pages/Settings';
import Parent from './pages/Parent';
import Mock from './pages/Mock';

export default function App() {
  useEffect(() => {
    seedIfEmpty(db);
  }, []);
  const data = useAppData();

  if (!data) return <div className="p-8 text-center text-slate-500">กำลังโหลด…</div>;
  if (!data.settings?.setupDone) return <Setup data={data} />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Today data={data} />} />
        <Route path="/log" element={<Log data={data} />} />
        <Route path="/review" element={<Review data={data} />} />
        <Route path="/progress" element={<Progress data={data} />} />
        <Route path="/mock" element={<Mock data={data} />} />
        <Route path="/parent" element={<Parent data={data} />} />
        <Route path="/settings" element={<SettingsPage data={data} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
