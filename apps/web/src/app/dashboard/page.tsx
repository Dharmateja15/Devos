'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const { accessToken, user, setUser, logout, refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      let currentToken = accessToken;

      if (!currentToken) {
        currentToken = await refresh();
        if (!currentToken) {
          router.push('/login');
          return;
        }
      }

      const res = await fetch('http://localhost:3001/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setStats(data.stats);
        setLoading(false);
      } else {
        // Try refresh once
        currentToken = await refresh();
        if (currentToken) {
          const retryRes = await fetch('http://localhost:3001/api/v1/auth/me', {
            headers: { Authorization: `Bearer ${currentToken}` },
          });
          if (retryRes.ok) {
            const data = await retryRes.json();
            setUser(data.user);
            setStats(data.stats);
            setLoading(false);
            return;
          }
        }
        router.push('/login');
      }
    };
    fetchUser();
  }, [router, accessToken, refresh, setUser]);

  if (loading || !user) return <div>Loading...</div>;

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
            <strong>Achievements ({stats.achievements.length}):</strong>
            <ul>
              {stats.achievements.map((ach: any) => (
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
