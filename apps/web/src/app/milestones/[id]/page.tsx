'use client';

import { useEffect, useState, use } from 'react';
import { useAuth } from '../../../context/AuthContext';
import Link from 'next/link';

export default function MilestoneDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { accessToken } = useAuth();
  const [milestone, setMilestone] = useState<any>(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (accessToken) {
      fetch(`http://localhost:3001/api/v1/milestones/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then(res => res.json())
      .then(data => setMilestone(data));
    }
  }, [accessToken, id]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`http://localhost:3001/api/v1/milestones/${id}/tasks`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const newTask = await res.json();
      setMilestone({
        ...milestone,
        tasks: [...(milestone.tasks || []), newTask]
      });
      setTitle('');
    }
  };

  if (!milestone) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <Link href={`/journeys/${milestone.journeyId}`}>← Back to Journey</Link>
      <h1>{milestone.title}</h1>
      <p>Progress: {milestone.progress}% ({milestone.completedTasks}/{milestone.totalTasks} Tasks)</p>
      
      <h2>Tasks</h2>
      <ul>
        {milestone.tasks?.map((t: any) => (
          <li key={t.id}>
            <Link href={`/tasks/${t.id}`}>{t.title}</Link> ({t.status})
          </li>
        ))}
      </ul>

      <form onSubmit={handleCreateTask}>
        <input placeholder="New Task Title" value={title} onChange={e => setTitle(e.target.value)} required />
        <button type="submit">Add Task</button>
      </form>
    </div>
  );
}
