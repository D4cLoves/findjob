import { useState, useEffect } from 'react';
import { Briefcase, Settings, ExternalLink, ThumbsUp, X, Shuffle } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStack, setFilterStack] = useState('all');
  const [stats, setStats] = useState({ total: 0, new: 0, applied: 0, skipped: 0 });

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
      fetchStats();
    } else {
      fetchVacancies();
    }
  }, [activeTab]);

  const shuffleArray = (array: any[]) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const fetchVacancies = async () => {
    setLoading(true);
    try {
      const status = activeTab === 'feed' ? 'new' : 'applied';
      const response = await fetch(`${API_URL}/vacancies?status=${status}`);
      let data = await response.json();
      if (activeTab === 'feed') {
        data = shuffleArray(data);
      }
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

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
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
      if (activeTab === 'feed' || status === 'skipped') {
        setVacancies(prev => prev.filter(v => v.id !== id));
      }
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

  const openLink = (url: string, vacancyId?: number, coverLetterText?: string) => {
    if (coverLetterText) {
      navigator.clipboard.writeText(coverLetterText);
    }
    if (vacancyId) {
      updateStatus(vacancyId, 'applied');
    }
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      if (url.startsWith('mailto:')) {
        window.location.href = url;
        return;
      }
      
      let targetUrl = url;
      // If we have a tg:// resolve link, transform it to a standard https://t.me/ link
      // because tg.openTelegramLink only supports the https://t.me/ scheme inside the SDK.
      if (targetUrl.startsWith('tg://resolve?domain=')) {
        const domain = targetUrl.replace('tg://resolve?domain=', '');
        targetUrl = `https://t.me/${domain}`;
      }
      
      if (targetUrl.startsWith('https://t.me/')) {
        tg.openTelegramLink(targetUrl);
      } else {
        tg.openLink(targetUrl);
      }
    } else {
      window.open(url, '_blank');
    }
  };

  const extractLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s()<>]+)/g;
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const tgRegex = /(@[a-zA-Z0-9_]{5,32})/g;
    
    const urls = text.match(urlRegex) || [];
    const emails = text.match(emailRegex) || [];
    const tgs = text.match(tgRegex) || [];
    
    // Clean trailing punctuation from URLs
    const cleanUrls = urls.map(u => /[.,;:!?]$/.test(u) ? u.slice(0, -1) : u);
    
    return {
      urls: Array.from(new Set(cleanUrls)),
      emails: Array.from(new Set(emails)),
      tgs: Array.from(new Set(tgs))
    };
  };

  const renderLinkifiedText = (text: string, vacancyId: number, coverLetterText?: string) => {
    const regex = /(https?:\/\/[^\s()<>]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(@[a-zA-Z0-9_]{5,32})/g;
    
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    
    regex.lastIndex = 0;
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        elements.push(text.substring(lastIndex, match.index));
      }
      
      const matchText = match[0];
      
      if (match[1]) { // URL
        let cleanUrl = matchText;
        let trailing = "";
        if (/[.,;:!?]$/.test(cleanUrl)) {
          trailing = cleanUrl.slice(-1);
          cleanUrl = cleanUrl.slice(0, -1);
        }
        
        elements.push(
          <span key={`url-${match.index}`}>
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault(); 
                openLink(cleanUrl, vacancyId, coverLetterText); 
              }}
              style={{ color: '#0a84ff', textDecoration: 'underline', cursor: 'pointer', wordBreak: 'break-all' }}
            >
              {cleanUrl}
            </a>
            {trailing}
          </span>
        );
      } else if (match[2]) { // Email
        elements.push(
          <a 
            key={`email-${match.index}`}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              openLink(`mailto:${matchText}`, vacancyId, coverLetterText);
            }}
            style={{ color: '#0a84ff', textDecoration: 'underline', wordBreak: 'break-all' }}
          >
            {matchText}
          </a>
        );
      } else if (match[3]) { // Telegram handle
        const cleanUsername = matchText.replace('@', '');
        elements.push(
          <a 
            key={`tg-${match.index}`}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              openLink(`https://t.me/${cleanUsername}`, vacancyId, coverLetterText);
            }}
            style={{ color: '#0a84ff', textDecoration: 'underline' }}
          >
            {matchText}
          </a>
        );
      }
      
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < text.length) {
      elements.push(text.substring(lastIndex));
    }
    
    return elements.length > 0 ? elements : text;
  };

  const renderVacancyCard = (vacancy: Vacancy) => {
    const isTg = vacancy.source_id.startsWith("tg_");
    const tgContact = isTg ? getTelegramContact(vacancy.description, vacancy.company) : null;
    const coverLetterText = letters[vacancy.id] || vacancy.cover_letter;
    const isExpanded = !!expandedVacancies[vacancy.id];
    const cleanDescription = vacancy.description.replace(/<[^>]+>/g, '').trim();
    const shouldTruncate = cleanDescription.length > 250;
    
    // Extract contact links for Quick Buttons
    const links = extractLinks(cleanDescription);
    const hasQuickLinks = links.urls.length > 0 || links.emails.length > 0 || links.tgs.length > 0;
    
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
              {renderLinkifiedText(cleanDescription, vacancy.id, coverLetterText)}
            </p>
            {shouldTruncate && !isExpanded && <div className="fade-overlay"></div>}
          </div>
          
          {shouldTruncate && (
            <button className="btn-link" onClick={() => toggleExpand(vacancy.id)}>
              {isExpanded ? "Свернуть описание" : "Развернуть описание"}
            </button>
          )}

          {/* Quick Links / Contacts Extracted Row */}
          {hasQuickLinks && (
            <div className="quick-links-section" style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.72rem', color: '#8e8e93', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.2px' }}>
                Быстрые контакты из описания:
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {links.urls.map((url, i) => {
                  let label = "Ссылка";
                  try {
                    const hostname = new URL(url).hostname;
                    label = hostname.replace('www.', '');
                  } catch (e) {}
                  return (
                    <button 
                      key={`ql-url-${i}`} 
                      className="btn btn-secondary" 
                      style={{ padding: '6px 10px', fontSize: '0.75rem', width: 'auto', flex: 'none', background: 'rgba(10, 132, 255, 0.1)', borderColor: 'rgba(10, 132, 255, 0.2)', color: '#0a84ff' }}
                      onClick={() => openLink(url, vacancy.id, coverLetterText)}
                    >
                      🔗 {label}
                    </button>
                  );
                })}
                {links.emails.map((email, i) => (
                  <button 
                    key={`ql-email-${i}`} 
                    className="btn btn-secondary" 
                    style={{ padding: '6px 10px', fontSize: '0.75rem', width: 'auto', flex: 'none', background: 'rgba(48, 209, 88, 0.1)', borderColor: 'rgba(48, 209, 88, 0.2)', color: '#30d158' }}
                    onClick={() => openLink(`mailto:${email}`, vacancy.id, coverLetterText)}
                  >
                    📧 {email}
                  </button>
                ))}
                {links.tgs.map((username, i) => {
                  const cleanUser = username.replace('@', '');
                  // Skip if it matches the current channel name
                  const channelName = vacancy.company.replace("Telegram Channel @", "").trim().toLowerCase();
                  if (cleanUser.toLowerCase() === channelName) return null;
                  
                  return (
                    <button 
                      key={`ql-tg-${i}`} 
                      className="btn btn-secondary" 
                      style={{ padding: '6px 10px', fontSize: '0.75rem', width: 'auto', flex: 'none', background: 'rgba(10, 132, 255, 0.1)', borderColor: 'rgba(10, 132, 255, 0.2)', color: '#0a84ff' }}
                      onClick={() => openLink(`https://t.me/${cleanUser}`, vacancy.id, coverLetterText)}
                    >
                      💬 {username}
                    </button>
                  );
                })}
              </div>
            </div>
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
              {activeTab === 'feed' && (
                <button 
                  className="btn btn-danger" 
                  style={{ flex: 0.25, minWidth: '40px', padding: '10px 0' }} 
                  onClick={() => updateStatus(vacancy.id, 'skipped')}
                  title="Скрыть вакансию"
                >
                  <X size={16} />
                </button>
              )}
              
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
                  <button className="btn btn-primary" style={{ flex: 1.4 }} onClick={() => openLink(`https://t.me/${tgContact.replace('@', '')}`, vacancy.id, coverLetterText)}>
                    <ExternalLink size={16} /> Откликнуться {tgContact}
                  </button>
                ) : (
                  <button className="btn btn-primary" style={{ flex: 1.4 }} onClick={() => openLink(vacancy.url, vacancy.id, coverLetterText)}>
                    <ExternalLink size={16} /> Пост в Telegram
                  </button>
                )
              ) : (
                <button className="btn btn-primary" style={{ flex: 1.4 }} onClick={() => openLink(vacancy.url, vacancy.id, coverLetterText)}>
                  <ExternalLink size={16} /> Откликнуться на HH
                </button>
              )}
            </div>

            {/* Delete button (Only in Applied tab) */}
            {activeTab === 'applied' && (
              <button className="btn btn-danger" style={{ width: '100%', padding: '8px 12px' }} onClick={() => updateStatus(vacancy.id, 'skipped')}>
                Удалить из откликов
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Filter vacancies locally based on search query and stack/source filters
  const filteredVacancies = vacancies.filter(v => {
    const textMatch = 
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      v.company.toLowerCase().includes(searchQuery.toLowerCase()) || 
      v.description.toLowerCase().includes(searchQuery.toLowerCase());
      
    if (!textMatch) return false;
    
    const descLower = v.description.toLowerCase();
    const titleLower = v.title.toLowerCase();
    const techLower = (v.tech_stack || "").toLowerCase();
    
    if (filterStack === 'csharp') {
      const isCs = descLower.includes('c#') || descLower.includes('dotnet') || descLower.includes('.net') || titleLower.includes('c#') || techLower.includes('c#');
      const isReact = descLower.includes('react') || titleLower.includes('react') || techLower.includes('react');
      return isCs && !isReact;
    }
    if (filterStack === 'react') {
      const isCs = descLower.includes('c#') || descLower.includes('dotnet') || descLower.includes('.net') || titleLower.includes('c#') || techLower.includes('c#');
      const isReact = descLower.includes('react') || titleLower.includes('react') || techLower.includes('react');
      return isReact && !isCs;
    }
    if (filterStack === 'fullstack') {
      const isCs = descLower.includes('c#') || descLower.includes('dotnet') || descLower.includes('.net') || titleLower.includes('c#') || techLower.includes('c#');
      const isReact = descLower.includes('react') || titleLower.includes('react') || techLower.includes('react');
      return isCs && isReact;
    }
    if (filterStack === 'hh') {
      return !v.source_id.startsWith('tg_');
    }
    if (filterStack === 'tg') {
      return v.source_id.startsWith('tg_');
    }
    return true;
  });

  return (
    <div className="app-container">
      <header className="header">
        <h1>{activeTab === 'feed' ? "Лента вакансий" : activeTab === 'applied' ? "Мои отклики" : "Настройки"}</h1>
      </header>

      <main className="main-content">
        {activeTab === 'settings' ? (
          <div>
            {/* Career stats grid */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <div className="stat-card">
                <div className="stat-label">Всего найдено</div>
                <div className="stat-value">{stats.total}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label" style={{ color: '#30d158' }}>Откликов отправлено</div>
                <div className="stat-value" style={{ color: '#30d158' }}>{stats.applied}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label" style={{ color: '#ffd60a' }}>Новых в ленте</div>
                <div className="stat-value" style={{ color: '#ffd60a' }}>{stats.new}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label" style={{ color: '#ff453a' }}>Скрытых</div>
                <div className="stat-value" style={{ color: '#ff453a' }}>{stats.skipped}</div>
              </div>
            </div>

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
          </div>
        ) : (
          <div>
            {/* Search and Filters container */}
            <div className="search-filter-container">
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Поиск по названию, компании..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1 }}
                />
                {activeTab === 'feed' && (
                  <button 
                    className="btn btn-secondary" 
                    style={{ width: '40px', flex: 'none', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid rgba(255,255,255,0.08)' }}
                    onClick={() => setVacancies(prev => shuffleArray(prev))}
                    title="Перемешать ленту"
                  >
                    <Shuffle size={16} />
                  </button>
                )}
              </div>
              <div className="filter-chips">
                <button className={`chip ${filterStack === 'all' ? 'active' : ''}`} onClick={() => setFilterStack('all')}>Все</button>
                <button className={`chip ${filterStack === 'csharp' ? 'active' : ''}`} onClick={() => setFilterStack('csharp')}>C#</button>
                <button className={`chip ${filterStack === 'react' ? 'active' : ''}`} onClick={() => setFilterStack('react')}>React</button>
                <button className={`chip ${filterStack === 'fullstack' ? 'active' : ''}`} onClick={() => setFilterStack('fullstack')}>Fullstack</button>
                <button className={`chip ${filterStack === 'hh' ? 'active' : ''}`} onClick={() => setFilterStack('hh')}>HH.ru</button>
                <button className={`chip ${filterStack === 'tg' ? 'active' : ''}`} onClick={() => setFilterStack('tg')}>Telegram</button>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', marginTop: '50px', color: '#aeaeb2', fontSize: '0.9rem' }}>
                Поиск вакансий...
              </div>
            ) : filteredVacancies.length > 0 ? (
              filteredVacancies.map(renderVacancyCard)
            ) : (
              <div style={{ textAlign: 'center', marginTop: '50px', color: '#aeaeb2', fontSize: '0.9rem' }}>
                Нет подходящих вакансий.
              </div>
            )}
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
          className={`nav-item ${activeTab === 'applied' ? 'active' : ''}`}
          onClick={() => setActiveTab('applied')}
          style={{ background: 'transparent' }}
        >
          <Briefcase />
          <span>Отклики</span>
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
