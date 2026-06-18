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
  cover_letter?: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

function App() {
  const [activeTab, setActiveTab] = useState('feed');
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCv, setUserCv] = useState('');
  const [cvSaving, setCvSaving] = useState(false);
  const [generatingLetterId, setGeneratingLetterId] = useState<number | null>(null);
  const [letters, setLetters] = useState<Record<number, string>>({});

  // Initialize Telegram WebApp (simulated if running in browser)
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchSettings();
    } else {
      fetchVacancies();
    }
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

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/settings`);
      const data = await response.json();
      setUserCv(data.user_cv || '');
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setCvSaving(true);
    try {
      await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_cv: userCv })
      });
      alert('Профиль сохранен!');
    } catch (error) {
      console.error("Error saving settings:", error);
      alert('Не удалось сохранить профиль.');
    } finally {
      setCvSaving(false);
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

  const generateLetter = async (id: number) => {
    setGeneratingLetterId(id);
    try {
      const response = await fetch(`${API_URL}/vacancies/${id}/generate-cover-letter`, {
        method: 'POST'
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Error");
      }
      const data = await response.json();
      setLetters(prev => ({ ...prev, [id]: data.cover_letter }));
    } catch (error: any) {
      console.error("Error generating letter:", error);
      alert(error.message || "Не удалось сгенерировать письмо. Пожалуйста, заполни профиль в Настройках!");
    } finally {
      setGeneratingLetterId(null);
    }
  };

  const getTelegramContact = (desc: string, company: string) => {
    const matches = desc.match(/@[a-zA-Z0-9_]{5,32}/g);
    if (!matches) return null;
    const channelUser = company.replace("Telegram Channel @", "").trim().toLowerCase();
    const filtered = matches.filter(username => username.toLowerCase() !== `@${channelUser}`);
    return filtered.length > 0 ? filtered[0] : null;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Сопроводительное письмо скопировано в буфер обмена!");
  };

  const renderVacancyCard = (vacancy: Vacancy) => {
    const isTg = vacancy.source_id.startsWith("tg_");
    const tgContact = isTg ? getTelegramContact(vacancy.description, vacancy.company) : null;
    const coverLetterText = letters[vacancy.id] || vacancy.cover_letter;
    
    return (
      <div className="vacancy-card" key={vacancy.id}>
        <div className="card-title">{vacancy.title}</div>
        <div className="card-company">
          <Briefcase size={16} /> {vacancy.company}
        </div>
        {vacancy.salary && <div className="card-salary">{vacancy.salary}</div>}
        
        <p style={{ fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: '600', marginBottom: '8px' }}>
          Теги: <span className="badge">{vacancy.tech_stack}</span>
        </p>
        
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px', whiteSpace: 'pre-wrap' }}>
          {vacancy.description.replace(/<[^>]+>/g, '').slice(0, 300) + (vacancy.description.length > 300 ? '...' : '')}
        </p>

        {coverLetterText && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--success-color)' }}>
                {isTg ? "✨ Сгенерированный питч для TG:" : "✨ Сопроводительное письмо для HH:"}
              </span>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '4px 8px', fontSize: '0.75rem', width: 'auto' }} 
                onClick={() => copyToClipboard(coverLetterText)}
              >
                Копировать
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto' }}>
              {coverLetterText}
            </p>
          </div>
        )}

        <div className="card-actions" style={{ flexWrap: 'wrap' }}>
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
            <>
              <button 
                className="btn btn-secondary" 
                disabled={generatingLetterId === vacancy.id}
                onClick={() => generateLetter(vacancy.id)}
              >
                {generatingLetterId === vacancy.id ? "Генерация..." : "🪄 Написать сопровод"}
              </button>
              
              {isTg ? (
                tgContact ? (
                  <button className="btn btn-primary" onClick={() => window.open(`https://t.me/${tgContact.replace('@', '')}`, '_blank')}>
                    <ExternalLink size={18} /> Написать {tgContact}
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={() => window.open(vacancy.url, '_blank')}>
                    <ExternalLink size={18} /> Открыть пост в TG
                  </button>
                )
              ) : (
                <button className="btn btn-primary" onClick={() => window.open(vacancy.url, '_blank')}>
                  <ExternalLink size={18} /> Открыть на HH.ru
                </button>
              )}
            </>
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
        {activeTab === 'settings' ? (
          <div style={{ background: 'var(--glass-bg)', padding: '20px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '12px' }}>Твой профиль для ИИ</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Опиши свой опыт, пет-проекты, навыки и приложи ссылки на GitHub / резюме. На основе этого текста Gemini будет генерировать индивидуальные сопроводительные письма.
            </p>
            <textarea
              style={{
                width: '100%',
                height: '250px',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                color: 'var(--text-primary)',
                padding: '12px',
                fontSize: '0.9rem',
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                marginBottom: '16px'
              }}
              value={userCv}
              onChange={(e) => setUserCv(e.target.value)}
              placeholder="Пример: Меня зовут Владислав. Мне 18 лет, занимаюсь разработкой с 14 лет. Мой стек: C#, ASP.NET, Entity Framework, React, TypeScript. Мой GitHub: github.com/username..."
            />
            <button 
              className="btn btn-primary" 
              disabled={cvSaving}
              onClick={saveSettings}
              style={{ width: '100%' }}
            >
              {cvSaving ? 'Сохранение...' : 'Сохранить профиль'}
            </button>
          </div>
        ) : loading ? (
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
