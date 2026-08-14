'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const { user, stats, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Dashboard</h1>
      <p>Welcome, {user.username} ({user.email})</p>
      
      {stats && (
        <div style={{ margin: '20px 0', padding: '15px', backgroundColor: '#161B22', borderRadius: '8px' }}>
          <h3>Gamification Stats</h3>
          <p><strong>XP Balance:</strong> {stats.xp}</p>
          <p><strong>Current Streak:</strong> {stats.streak} days (Longest: {stats.longestStreak} days)</p>
          <div>
            <strong>Achievements ({stats.achievements?.length || 0}):</strong>
            <ul>
              {stats.achievements?.map((ach: any) => (
                <li key={ach.id}>{ach.name} - {ach.description}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div><Link href="/journeys">My Journeys</Link></div>
      <button onClick={logout} style={{ marginTop: 20 }}>Logout</button>
    </div>
  );
}
