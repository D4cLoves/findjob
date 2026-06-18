import { useState, useEffect } from 'react';
import { Briefcase, Bookmark, Settings, ExternalLink, ThumbsUp, X } from 'lucide-react';
import './App.css';

// Type definitions
interface Vacancy {
  id: number;
  source_id: string;
  title: string;
  company: string;
  salary: string;
  url: string;
  description: string;
  tech_stack: string;
  status: string;
}

const API_URL = "http://localhost:8000/api";

function App() {
  const [activeTab, setActiveTab] = useState('feed');
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize Telegram WebApp (simulated if running in browser)
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      // Inform Telegram that the app is ready
    }
  }, []);

  useEffect(() => {
    fetchVacancies();
  }, [activeTab]);

  const fetchVacancies = async () => {
    setLoading(true);
    try {
      const status = activeTab === 'feed' ? 'new' : 'saved';
      const response = await fetch(`${API_URL}/vacancies?status=${status}`);
      const data = await response.json();
      setVacancies(data);
    } catch (error) {
      console.error("Error fetching vacancies:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await fetch(`${API_URL}/vacancies/${id}/status?status=${status}`, {
        method: 'POST'
      });
      // Remove from current list
      setVacancies(vacancies.filter(v => v.id !== id));
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const renderVacancyCard = (vacancy: Vacancy) => {
    const stackList = vacancy.tech_stack ? vacancy.tech_stack.split(' ') : [];
    
    return (
      <div className="vacancy-card" key={vacancy.id}>
        <div className="card-title">{vacancy.title}</div>
        <div className="card-company">
          <Briefcase size={16} /> {vacancy.company}
        </div>
        {vacancy.salary && <div className="card-salary">{vacancy.salary}</div>}
        
        <div className="card-stack">
          {stackList.map((tech, idx) => (
            <span key={idx} className="badge">{tech}</span>
          ))}
        </div>
        
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {vacancy.description.replace(/<[^>]+>/g, '')}
        </p>

        <div className="card-actions">
          {activeTab === 'feed' ? (
            <>
              <button className="btn btn-secondary" onClick={() => updateStatus(vacancy.id, 'skipped')}>
                <X size={18} /> Пропустить
              </button>
              <button className="btn btn-primary" onClick={() => updateStatus(vacancy.id, 'saved')}>
                <Bookmark size={18} /> Сохранить
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => window.open(vacancy.url, '_blank')}>
              <ExternalLink size={18} /> Открыть на HH.ru
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>FindJobBot</h1>
      </header>

      <main className="main-content">
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--text-secondary)' }}>
            Загрузка вакансий...
          </div>
        ) : vacancies.length > 0 ? (
          vacancies.map(renderVacancyCard)
        ) : (
          <div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--text-secondary)' }}>
            Пока нет новых вакансий.
          </div>
        )}
      </main>

      <nav className="bottom-nav">
        <button 
          className={`nav-item ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
          style={{ background: 'transparent' }}
        >
          <ThumbsUp />
          <span>Лента</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'saved' ? 'active' : ''}`}
          onClick={() => setActiveTab('saved')}
          style={{ background: 'transparent' }}
        >
          <Bookmark />
          <span>Сохраненные</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
          style={{ background: 'transparent' }}
        >
          <Settings />
          <span>Настройки</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
