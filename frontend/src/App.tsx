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
  const [expandedVacancies, setExpandedVacancies] = useState<Record<number, boolean>>({});

  const toggleExpand = (id: number) => {
    setExpandedVacancies(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Initialize Telegram WebApp
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
      alert(error.message || "Не удалось сгенерировать письмо. Заполни профиль во вкладке Настройки!");
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
    alert("Скопировано!");
  };

  const openLink = (url: string, coverLetterText?: string) => {
    if (coverLetterText) {
      navigator.clipboard.writeText(coverLetterText);
    }
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      if (url.startsWith('https://t.me/') || url.startsWith('tg://')) {
        tg.openTelegramLink(url);
      } else {
        tg.openLink(url);
      }
    } else {
      window.open(url, '_blank');
    }
  };

  const renderVacancyCard = (vacancy: Vacancy) => {
    const isTg = vacancy.source_id.startsWith("tg_");
    const tgContact = isTg ? getTelegramContact(vacancy.description, vacancy.company) : null;
    const coverLetterText = letters[vacancy.id] || vacancy.cover_letter;
    const isExpanded = !!expandedVacancies[vacancy.id];
    const cleanDescription = vacancy.description.replace(/<[^>]+>/g, '').trim();
    const shouldTruncate = cleanDescription.length > 250;
    
    return (
      <div className="vacancy-card" key={vacancy.id}>
        {/* macOS Style Titlebar */}
        <div className="window-titlebar">
          <div className="window-dots">
            <span className="dot dot-red"></span>
            <span className="dot dot-yellow"></span>
            <span className="dot dot-green"></span>
          </div>
          <div className="window-title">{isTg ? "Telegram Vacancy" : "HH.ru Vacancy"}</div>
        </div>

        <div className="card-body">
          <div className="card-title">{vacancy.title}</div>
          <div className="card-company">
            <Briefcase size={14} /> {vacancy.company}
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
            {vacancy.salary && <span className="card-salary">{vacancy.salary}</span>}
            <span className="badge">{vacancy.tech_stack}</span>
          </div>
          
          <div className={`description-container ${shouldTruncate && !isExpanded ? 'collapsed' : 'expanded'}`}>
            <p className="description-text">
              {cleanDescription}
            </p>
            {shouldTruncate && !isExpanded && <div className="fade-overlay"></div>}
          </div>
          
          {shouldTruncate && (
            <button className="btn-link" onClick={() => toggleExpand(vacancy.id)}>
              {isExpanded ? "Свернуть описание" : "Развернуть описание"}
            </button>
          )}

          {/* Generated Cover Letter notes style */}
          {coverLetterText && (
            <div className="ai-note-box">
              <div className="ai-note-header">
                <span>{isTg ? "✨ ТЕЛЕГРАМ ПИТЧ" : "✨ СОПРОВОДИТЕЛЬНОЕ ПИСЬМО"}</span>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '0.7rem', width: 'auto' }} 
                  onClick={() => copyToClipboard(coverLetterText)}
                >
                  Копировать
                </button>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#f2f2f7', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto', lineHeight: '1.4' }}>
                {coverLetterText}
              </p>
            </div>
          )}

          <div className="card-actions" style={{ flexDirection: 'column', gap: '8px' }}>
            {/* Action Buttons Row */}
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                disabled={generatingLetterId === vacancy.id}
                onClick={() => generateLetter(vacancy.id)}
              >
                {generatingLetterId === vacancy.id ? "Магия ИИ..." : "🪄 Сопровод"}
              </button>
              
              {isTg ? (
                tgContact ? (
                  <button className="btn btn-primary" style={{ flex: 1.2 }} onClick={() => openLink(`https://t.me/${tgContact.replace('@', '')}`, coverLetterText)}>
                    <ExternalLink size={16} /> Откликнуться {tgContact}
                  </button>
                ) : (
                  <button className="btn btn-primary" style={{ flex: 1.2 }} onClick={() => openLink(vacancy.url, coverLetterText)}>
                    <ExternalLink size={16} /> Пост в Telegram
                  </button>
                )
              ) : (
                <button className="btn btn-primary" style={{ flex: 1.2 }} onClick={() => openLink(vacancy.url, coverLetterText)}>
                  <ExternalLink size={16} /> Откликнуться на HH
                </button>
              )}
            </div>

            {/* Skip/Save Row (Only in Feed tab) */}
            {activeTab === 'feed' && (
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => updateStatus(vacancy.id, 'skipped')}>
                  <X size={16} /> Скрыть
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => updateStatus(vacancy.id, 'saved')}>
                  <Bookmark size={16} /> В избранное
                </button>
              </div>
            )}
            
            {/* Delete button (Only in Saved tab) */}
            {activeTab === 'saved' && (
              <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => updateStatus(vacancy.id, 'skipped')}>
                Удалить из сохраненных
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>{activeTab === 'feed' ? "Лента вакансий" : activeTab === 'saved' ? "Избранное" : "Настройки"}</h1>
      </header>

      <main className="main-content">
        {activeTab === 'settings' ? (
          <div style={{ background: '#1c1c1e', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: '1.05rem', marginBottom: '8px', fontWeight: '600' }}>Резюме и ссылки для ИИ</h2>
            <p style={{ fontSize: '0.8rem', color: '#aeaeb2', marginBottom: '16px', lineHeight: '1.4' }}>
              Опиши свои навыки, проекты и опыт. Вставь ссылки на GitHub и резюме. На основе этого текста ИИ будет генерировать письма рекрутерам.
            </p>
            <textarea
              style={{
                width: '100%',
                height: '240px',
                background: '#121212',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '12px',
                fontSize: '0.88rem',
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                marginBottom: '16px',
                lineHeight: '1.4'
              }}
              value={userCv}
              onChange={(e) => setUserCv(e.target.value)}
              placeholder="Пример: Меня зовут Владислав. Мне 18 лет, пишу код с 14 лет. Мой стек: C#, ASP.NET, Entity Framework, React, TypeScript. Мой GitHub: github.com/D4cLoves..."
            />
            <button 
              className="btn btn-primary" 
              disabled={cvSaving}
              onClick={saveSettings}
              style={{ width: '100%', padding: '12px' }}
            >
              {cvSaving ? 'Сохранение...' : 'Сохранить настройки'}
            </button>
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', marginTop: '50px', color: '#aeaeb2', fontSize: '0.9rem' }}>
            Поиск вакансий...
          </div>
        ) : vacancies.length > 0 ? (
          vacancies.map(renderVacancyCard)
        ) : (
          <div style={{ textAlign: 'center', marginTop: '50px', color: '#aeaeb2', fontSize: '0.9rem' }}>
            Нет новых вакансий по фильтрам.
          </div>
        )}
      </main>

      {/* macOS Dock Bottom Navigation */}
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
          <span>Избранное</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
          style={{ background: 'transparent' }}
        >
          <Settings />
          <span>Профиль</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
